ALTER TABLE lectures
  ALTER COLUMN pdf_data TYPE JSONB USING pdf_data::jsonb;
