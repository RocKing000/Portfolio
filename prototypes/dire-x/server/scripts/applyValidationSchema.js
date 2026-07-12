#!/usr/bin/env node
'use strict';

/**
 * scripts/applyValidationSchema.js
 *
 * Applies the validation system database schema additions.
 * Reads validation_schema.sql and executes it against Supabase.
 *
 * Usage: node scripts/applyValidationSchema.js
 * npm script: npm run migrate:validation
 *
 * Note: Supabase's JS client does not support multi-statement SQL directly.
 * This script splits the file into individual statements and runs them sequentially.
 * For production, prefer applying via psql or the Supabase dashboard SQL editor.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const supabase = require('../src/config/supabase');

const SCHEMA_PATH = path.join(__dirname, '../src/api/db/validation_schema.sql');

async function main() {
  console.log('\n═══════════════════════════════════════');
  console.log('  DIRE-X Validation Schema Migration');
  console.log('═══════════════════════════════════════\n');

  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');

  // Split on semicolons but preserve DO $$ ... $$ blocks
  const statements = splitSQL(sql);
  console.log(`Applying ${statements.length} SQL statement(s)...\n`);

  let applied = 0;
  let failed = 0;

  for (const stmt of statements) {
    const preview = stmt.trim().slice(0, 60).replace(/\n/g, ' ');
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      if (error) {
        // Some errors are benign (duplicate column if re-run)
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`  ⚠ SKIPPED (already exists): ${preview}...`);
        } else {
          console.error(`  ✗ FAILED: ${preview}...\n    Error: ${error.message}`);
          failed++;
        }
      } else {
        console.log(`  ✓ OK: ${preview}...`);
        applied++;
      }
    } catch (err) {
      console.error(`  ✗ EXCEPTION: ${preview}...\n    ${err.message}`);
      failed++;
    }
  }

  console.log(`\n  Applied: ${applied}  Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n  ⚠ Some statements failed. For manual application:');
    console.log('    psql $DATABASE_URL < src/api/db/validation_schema.sql');
    console.log('  Or paste into Supabase dashboard → SQL Editor.\n');
  } else {
    console.log('\n  ✓ Migration complete.\n');
  }
}

/**
 * Split SQL file into individual statements, preserving PL/pgSQL dollar-quoted blocks.
 * @param {string} sql
 * @returns {string[]}
 */
function splitSQL(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';

  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip pure comment lines
    if (trimmed.startsWith('--')) {
      current += line + '\n';
      continue;
    }

    // Detect dollar-quote boundaries
    const dollarMatch = trimmed.match(/(\$\$|\$[a-zA-Z_]+\$)/g);
    if (dollarMatch) {
      for (const tag of dollarMatch) {
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = tag;
        } else if (tag === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        }
      }
    }

    current += line + '\n';

    if (!inDollarQuote && trimmed.endsWith(';')) {
      const stmt = current.trim();
      if (stmt.length > 1) statements.push(stmt);
      current = '';
    }
  }

  if (current.trim()) statements.push(current.trim());
  return statements.filter(s => s.replace(/--.*$/gm, '').trim().length > 0);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
