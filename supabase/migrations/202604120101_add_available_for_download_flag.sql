-- Add available_for_download flag to beats table
ALTER TABLE public.beats
ADD COLUMN available_for_download boolean DEFAULT false;

COMMENT ON COLUMN public.beats.available_for_download IS 'Whether this beat is available for download by registered users';
