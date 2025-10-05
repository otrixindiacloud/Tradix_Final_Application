const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/tradi_erp'
});

async function testSupplierQuotes() {
  try {
    console.log('Testing supplier quotes...');
    
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'supplier_quotes'
      );
    `);
    console.log('Table exists:', tableCheck.rows[0].exists);
    
    // Check table structure
    const structure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'supplier_quotes'
      ORDER BY ordinal_position;
    `);
    console.log('Table structure:', structure.rows);
    
    // Check if there are any records
    const count = await pool.query('SELECT COUNT(*) FROM supplier_quotes');
    console.log('Record count:', count.rows[0].count);
    
    // Try to select some records
    const records = await pool.query('SELECT * FROM supplier_quotes LIMIT 5');
    console.log('Sample records:', records.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testSupplierQuotes();
