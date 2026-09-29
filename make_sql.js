const { execSync } = require('child_process');
const fs = require('fs');

const sql = `
  ALTER TABLE eventos ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '{}'::jsonb;
`;
fs.writeFileSync('fix_sql.sql', sql, 'utf-8');
console.log('SQL file created');
