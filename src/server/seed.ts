import { eq, sql } from 'drizzle-orm';
import { db, ensureDatabaseSchema, hasDatabaseConfig } from '../db/index.ts';
import { squads, players } from '../db/schema.ts';
import { OFFICIAL_SQUADS, type SeedSquad } from './officialSquads.ts';

let seedPromise: Promise<void> | null = null;

async function insertSeedSquad(squadData: SeedSquad): Promise<void> {
  const [insertedSquad] = await db
    .insert(squads)
    .values({
      name: squadData.name,
      season: squadData.season,
      country: squadData.country,
      competition: squadData.competition || null,
      crestUrl: squadData.crestUrl,
      isExample: squadData.isExample,
      isFinalOnly: Boolean(squadData.isFinalOnly),
    })
    .returning();

  if (insertedSquad && squadData.players.length > 0) {
    await db.insert(players).values(
      squadData.players.map((p) => ({
        squadId: insertedSquad.id,
        fullName: p.fullName,
        nickname: p.nickname,
        shirtNumber: p.shirtNumber,
        primaryPosition: p.primaryPosition,
        secondaryPositions: p.secondaryPositions,
        rating: p.rating,
        isLegendary: p.isLegendary,
        photoUrl: p.photoUrl || null,
      }))
    );
  }
}

function getOfficialSquadKey(name: string, competition: string | null | undefined): string {
  return `${name.trim().toLowerCase()}::${(competition || '').trim().toLowerCase()}`;
}

export async function ensureInitialExampleData(): Promise<void> {
  if (!hasDatabaseConfig) return;
  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        await ensureDatabaseSchema();
        const existingSquads = await db.select().from(squads);
        if (existingSquads.length === 0) {
          for (const squadData of OFFICIAL_SQUADS) {
            await insertSeedSquad(squadData);
          }
          return;
        }

        // If DB still only holds the 4 untouched old "(Exemplo)" placeholder squads,
        // upgrade them to the official game squads cleanly.
        const allExamples =
          existingSquads.length > 0 && existingSquads.every((s) => s.isExample);
        if (allExamples) {
          const campRes = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(sql`campaigns`);
          const campaignCount = campRes[0]?.count ?? 0;
          if (campaignCount === 0) {
            for (const ex of existingSquads) {
              await db.delete(squads).where(eq(squads.id, ex.id));
            }
            for (const squadData of OFFICIAL_SQUADS) {
              await insertSeedSquad(squadData);
            }
            return;
          }
        }

        const existingByKey = new Map(
          existingSquads.map((s) => [getOfficialSquadKey(s.name, s.competition), s])
        );

        for (const squadData of OFFICIAL_SQUADS) {
          const key = getOfficialSquadKey(squadData.name, squadData.competition);
          const existing = existingByKey.get(key);
          if (!existing) {
            await insertSeedSquad(squadData);
          } else if (!existing.crestUrl && squadData.crestUrl) {
            await db
              .update(squads)
              .set({ crestUrl: squadData.crestUrl })
              .where(eq(squads.id, existing.id));
          }
        }
      } catch (error) {
        console.error('Error seeding official squads:', error);
        seedPromise = null;
      }
    })();
  }
  await seedPromise;
}
