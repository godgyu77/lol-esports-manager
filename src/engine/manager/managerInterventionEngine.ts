import { getDatabase } from '../../db/database';

export interface ActiveInterventionEffect {
  playerId: string;
  moraleBonus: number;
  formBonus: number;
  topic: string | null;
  endDate: string;
}

export async function recordPlayerMeetingEffect(input: {
  playerId: string;
  teamId: string;
  topic: string;
  startDate: string;
  moraleBonus: number;
  formBonus?: number;
  durationDays?: number;
  notes?: string;
}): Promise<void> {
  const db = await getDatabase();
  const durationDays = input.durationDays ?? 7;

  await db.execute(
    `DELETE FROM manager_interventions
     WHERE player_id = $1 AND intervention_type = 'meeting' AND end_date >= $2`,
    [input.playerId, input.startDate],
  );

  await db.execute(
    `INSERT INTO manager_interventions
      (player_id, team_id, intervention_type, topic, start_date, end_date, morale_bonus, form_bonus, notes)
     VALUES ($1, $2, 'meeting', $3, $4, date($4, '+' || $5 || ' days'), $6, $7, $8)`,
    [
      input.playerId,
      input.teamId,
      input.topic,
      input.startDate,
      durationDays,
      input.moraleBonus,
      input.formBonus ?? 0,
      input.notes ?? null,
    ],
  );
}

export async function getActiveInterventionEffects(date: string): Promise<Map<string, ActiveInterventionEffect>> {
  const db = await getDatabase();
  const rows = await db.select<{
    player_id: string;
    morale_bonus: number;
    form_bonus: number;
    topic: string | null;
    end_date: string;
  }[]>(
    `SELECT player_id, morale_bonus, form_bonus, topic, end_date
     FROM manager_interventions
     WHERE start_date <= $1 AND end_date >= $1`,
    [date],
  );

  const result = new Map<string, ActiveInterventionEffect>();
  for (const row of rows) {
    result.set(row.player_id, {
      playerId: row.player_id,
      moraleBonus: row.morale_bonus,
      formBonus: row.form_bonus,
      topic: row.topic,
      endDate: row.end_date,
    });
  }
  return result;
}
