const { query } = require('../config/postgres');

class AuctionRepository {
  async getAllAuctions({ status, search } = {}) {
    let sql = `
      SELECT 
        id,
        title,
        title AS "itemName",
        description,
        starting_price AS "startingPrice",
        starting_price AS "startingBid",
        current_highest_bid AS "currentHighestBid",
        current_highest_bid AS "highestBid",
        highest_bidder_id AS "highestBidderId",
        start_time AS "startTime",
        end_time AS "endTime",
        status,
        created_at AS "createdAt",
        NOW() AS "currentDbTime"
      FROM auctions
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status.toUpperCase());
      sql += ` AND status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    sql += ` ORDER BY status ASC, created_at DESC`;

    const result = await query(sql, params);
    const auctions = result.rows;

    // Populate highest bidder names
    const bidderIds = auctions.map(a => a.highestBidderId).filter(Boolean);
    if (bidderIds.length > 0) {
      const usersRes = await query(`SELECT id, name FROM users`);
      const userMap = new Map(usersRes.rows.map(u => [u.id, u.name]));
      for (const a of auctions) {
        a.highestBidderName = a.highestBidderId ? (userMap.get(a.highestBidderId) || null) : null;
      }
    } else {
      for (const a of auctions) {
        a.highestBidderName = null;
      }
    }

    return auctions;
  }

  async getCurrentAuction() {
    const sql = `
      SELECT 
        id,
        title,
        title AS "itemName",
        description,
        starting_price AS "startingPrice",
        starting_price AS "startingBid",
        current_highest_bid AS "currentHighestBid",
        current_highest_bid AS "highestBid",
        highest_bidder_id AS "highestBidderId",
        start_time AS "startTime",
        end_time AS "endTime",
        status,
        created_at AS "createdAt",
        NOW() AS "currentDbTime"
      FROM auctions
      ORDER BY status ASC, created_at DESC
      LIMIT 1
    `;
    const result = await query(sql);
    const auction = result.rows[0] || null;
    if (auction && auction.highestBidderId) {
      const userRes = await query(`SELECT name FROM users WHERE id = $1`, [auction.highestBidderId]);
      auction.highestBidderName = userRes.rows[0]?.name || null;
    } else if (auction) {
      auction.highestBidderName = null;
    }
    return auction;
  }

  async findById(id) {
    const sql = `
      SELECT 
        id,
        title,
        title AS "itemName",
        description,
        starting_price AS "startingPrice",
        starting_price AS "startingBid",
        current_highest_bid AS "currentHighestBid",
        current_highest_bid AS "highestBid",
        highest_bidder_id AS "highestBidderId",
        start_time AS "startTime",
        end_time AS "endTime",
        status,
        created_at AS "createdAt",
        NOW() AS "currentDbTime"
      FROM auctions
      WHERE id = $1
    `;
    const result = await query(sql, [id]);
    const auction = result.rows[0] || null;
    if (auction && auction.highestBidderId) {
      const userRes = await query(`SELECT name FROM users WHERE id = $1`, [auction.highestBidderId]);
      auction.highestBidderName = userRes.rows[0]?.name || null;
    } else if (auction) {
      auction.highestBidderName = null;
    }
    return auction;
  }

  async findByIdForUpdate(client, id) {
    // CRITICAL: Row-level lock on specific auction row within active transaction
    const sql = `
      SELECT 
        id,
        title,
        title AS "itemName",
        description,
        starting_price AS "startingPrice",
        starting_price AS "startingBid",
        current_highest_bid AS "currentHighestBid",
        current_highest_bid AS "highestBid",
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
        title AS "itemName",
        current_highest_bid AS "currentHighestBid",
        current_highest_bid AS "highestBid",
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
