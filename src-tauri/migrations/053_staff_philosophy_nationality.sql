-- staff 테이블에 누락된 philosophy/nationality 컬럼 추가
ALTER TABLE staff ADD COLUMN philosophy TEXT DEFAULT NULL;
ALTER TABLE staff ADD COLUMN nationality TEXT DEFAULT NULL;
