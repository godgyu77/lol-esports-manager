-- 시드 기반 RNG: save_metadata에 rng_seed 컬럼 추가
ALTER TABLE save_metadata ADD COLUMN rng_seed TEXT;
