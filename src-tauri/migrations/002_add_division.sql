-- division 컬럼 추가 (1군/2군 구분)
ALTER TABLE players ADD COLUMN division TEXT NOT NULL DEFAULT 'main';
