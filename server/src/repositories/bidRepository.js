const { query } = require('../config/postgres');

class BidRepository {
  async create(client, { id, auctionId, bidderId, amount }) {
    const sql = `
      INSERT INTO bids (id, auction_id, bidder_id, amount, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, auction_id AS "auctionId", bidder_id AS "bidderId", amount, created_at AS "createdAt"
    `;
    const result = await client.query(sql, [id, auctionId, bidderId, amount]);
    return result.rows[0];
  }

  async getBidsByAuction(auctionId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    // Count total bids
    const countSql = `
      SELECT COUNT(*) AS total
      FROM bids
      WHERE auction_id = $1
    `;
    const countResult = await query(countSql, [auctionId]);
    const total = parseInt(countResult.rows[0]?.total || 0, 10);
    const totalPages = Math.ceil(total / limit) || 1;

    // Fetch paginated bids with bidder name
    const bidsSql = `
      SELECT 
        b.id,
        b.auction_id AS "auctionId",
        b.bidder_id AS "bidderId",
        u.name AS "bidderName",
        b.amount,
        b.created_at AS "createdAt"
      FROM bids b
      JOIN users u ON b.bidder_id = u.id
      WHERE b.auction_id = $1
      ORDER BY b.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const bidsResult = await query(bidsSql, [auctionId, limit, offset]);

    return {
      bids: bidsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }
}

module.exports = new BidRepository();
