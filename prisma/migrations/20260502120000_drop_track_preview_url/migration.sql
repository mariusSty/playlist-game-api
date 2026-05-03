-- Drop Track.previewUrl: Deezer preview URLs are signed and expire after ~30 minutes.
-- Clients now re-fetch a fresh preview from api.deezer.com/track/{id} on demand.

ALTER TABLE "Track" DROP COLUMN "previewUrl";
