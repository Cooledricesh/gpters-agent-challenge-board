function codedError(code, message = code) {
  return Object.assign(new Error(message), { code });
}

async function withTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export function createRepository(pool) {
  return {
    async health() {
      const { rows } = await pool.query(
        "select current_database() as database, current_user as role, to_regclass('public.app_users') is not null as schema_ready",
      );
      return rows[0];
    },

    async board() {
      const [users, challenges, examples, completions] = await Promise.all([
        pool.query("select id, nickname, role, anonymous_label, anonymous_index from app_users where role = 'student'"),
        pool.query("select id, title, description, detail, order_index, level, area, tier, prerequisite_id, created_at, updated_at from challenges order by tier, order_index, created_at"),
        pool.query("select id, challenge_id, cohort, title, summary, source_url, source_author, order_index, created_at from challenge_examples order by challenge_id, order_index, created_at"),
        pool.query("select id, user_id, challenge_id, completed_at from completions"),
      ]);
      return {
        users: users.rows,
        challenges: challenges.rows,
        examples: examples.rows,
        completions: completions.rows,
      };
    },

    async findUserByNickname(nickname) {
      const { rows } = await pool.query(
        "select id, nickname, role, password_hash from app_users where nickname = $1 limit 1",
        [nickname],
      );
      return rows[0] ?? null;
    },

    async toggleCompletion({ userId, challengeId, done }) {
      if (done) {
        const { rows } = await pool.query(
          `insert into completions (user_id, challenge_id) values ($1, $2)
           on conflict (user_id, challenge_id) do update set user_id = excluded.user_id
           returning id, user_id, challenge_id, completed_at`,
          [userId, challengeId],
        );
        return { done: true, completion: rows[0] };
      }
      await pool.query(
        "delete from completions where user_id = $1 and challenge_id = $2",
        [userId, challengeId],
      );
      return { done: false, completion: null };
    },

    async createStudent({ nickname, passwordHash }) {
      return withTransaction(pool, async (client) => {
        await client.query("lock table app_users in share row exclusive mode");
        const duplicate = await client.query("select 1 from app_users where nickname = $1", [nickname]);
        if (duplicate.rowCount) throw codedError("nickname_conflict");
        const { rows: indexRows } = await client.query(
          "select coalesce(max(anonymous_index), 0) + 1 as next_index from app_users where role = 'student'",
        );
        const nextIndex = indexRows[0].next_index;
        const anonymousLabel = `챌린저 ${String(nextIndex).padStart(2, "0")}`;
        const { rows } = await client.query(
          `insert into app_users (nickname, role, password_hash, anonymous_index, anonymous_label)
           values ($1, 'student', $2, $3, $4)
           returning id, nickname, anonymous_label, anonymous_index`,
          [nickname, passwordHash, nextIndex, anonymousLabel],
        );
        return rows[0];
      });
    },

    async updateStudentPassword({ id, passwordHash }) {
      const { rows } = await pool.query(
        `update app_users set password_hash = $2
         where id = $1 and role = 'student'
         returning id, nickname`,
        [id, passwordHash],
      );
      return rows[0] ?? null;
    },

    async deleteStudent({ id }) {
      const { rows } = await pool.query(
        `delete from app_users where id = $1 and role = 'student'
         returning id, nickname`,
        [id],
      );
      return rows[0] ?? null;
    },

    async createChallenge(input) {
      return withTransaction(pool, async (client) => {
        await client.query("lock table challenges in share row exclusive mode");
        const { rows: orderRows } = await client.query(
          "select coalesce(max(order_index), 0) + 1 as next_order from challenges",
        );
        const { rows } = await client.query(
          `insert into challenges (
             title, description, detail, level, area, tier, prerequisite_id, order_index
           ) values ($1,$2,$3,$4,$5,$6,$7,$8)
           returning *`,
          [
            input.title,
            input.description ?? null,
            input.detail ?? null,
            input.level ?? "basic",
            input.area ?? null,
            input.tier ?? 1,
            input.prerequisiteId ?? null,
            orderRows[0].next_order,
          ],
        );
        return rows[0];
      });
    },

    async updateChallenge({ id, ...input }) {
      const fields = [];
      const values = [id];
      const mapping = {
        title: "title",
        description: "description",
        detail: "detail",
        level: "level",
        area: "area",
        tier: "tier",
        prerequisiteId: "prerequisite_id",
      };
      for (const [key, column] of Object.entries(mapping)) {
        if (Object.hasOwn(input, key)) {
          values.push(input[key]);
          fields.push(`${column} = $${values.length}`);
        }
      }
      if (!fields.length) return null;
      const { rows } = await pool.query(
        `update challenges set ${fields.join(", ")} where id = $1 returning *`,
        values,
      );
      return rows[0] ?? null;
    },
  };
}
