const { query } = require('../config/postgres');

class UserRepository {
  async create({ id, name, email, passwordHash }) {
    const sql = `
      INSERT INTO users (id, name, email, password_hash, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, name, email, created_at
    `;
    const result = await query(sql, [id, name, email, passwordHash]);
    return result.rows[0];
  }

  async findByEmail(email) {
    const sql = `
      SELECT id, name, email, password_hash, created_at
      FROM users
      WHERE email = $1
    `;
    const result = await query(sql, [email]);
    return result.rows[0] || null;
  }

  async findById(id) {
    const sql = `
      SELECT id, name, email, created_at
      FROM users
      WHERE id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }
}

module.exports = new UserRepository();
