const { query } = require('../config/postgres');

class AuctionRepository {
  async getCurrentAuction() {
    const sql = `
      SELECT 
        a.id,
        a.title,
        a.description,
        a.starting_price AS "startingPrice",
        a.current_highest_bid AS "currentHighestBid",
        a.highest_bidder_id AS "highestBidderId",
        u.name AS "highestBidderName",
        a.start_time AS "startTime",
        a.end_time AS "endTime",
        a.status,
        a.created_at AS "createdAt",
        NOW() AS "currentDbTime"
      FROM auctions a
      LEFT JOIN users u ON a.highest_bidder_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 1
    `;
    const result = await query(sql);
    return result.rows[0] || null;
  }

  async findById(id) {
    const sql = `
      SELECT 
        a.id,
        a.title,
        a.description,
        a.starting_price AS "startingPrice",
        a.current_highest_bid AS "currentHighestBid",
        a.highest_bidder_id AS "highestBidderId",
        u.name AS "highestBidderName",
        a.start_time AS "startTime",
        a.end_time AS "endTime",
        a.status,
        a.created_at AS "createdAt",
        NOW() AS "currentDbTime"
      FROM auctions a
      LEFT JOIN users u ON a.highest_bidder_id = u.id
      WHERE a.id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  async findByIdForUpdate(client, id) {
    // CRITICAL: Row-level lock within active transaction with database timestamp
    const sql = `
      SELECT 
        id,
        title,
        description,
        starting_price AS "startingPrice",
        current_highest_bid AS "currentHighestBid",
        highest_bidder_id AS "highestBidderId",
        start_time AS "startTime",
        end_time AS "endTime",
        status,
        created_at AS "createdAt",
        NOW() AS "currentDbTime"
      FROM auctions
      WHERE id = $1
      FOR UPDATE
    `;
    const result = await client.query(sql, [id]);
    return result.rows[0] || null;
  }

  async updateHighestBid(client, id, amount, bidderId) {
    const sql = `
      UPDATE auctions
      SET 
        current_highest_bid = $1,
        highest_bidder_id = $2
      WHERE id = $3
      RETURNING 
        id,
        title,
        current_highest_bid AS "currentHighestBid",
        highest_bidder_id AS "highestBidderId",
        end_time AS "endTime",
        status
    `;
    const result = await client.query(sql, [amount, bidderId, id]);
    return result.rows[0] || null;
  }

  async updateStatus(id, status) {
    const sql = `
      UPDATE auctions
      SET status = $1
      WHERE id = $2
      RETURNING id, status
    `;
    const result = await query(sql, [status, id]);
    return result.rows[0] || null;
  }
}

module.exports = new AuctionRepository();
