-- Function to get next message number (atomic operation)
-- This function atomically increments and returns the next message_no for a channel
-- It handles the initial insert if the channel sequence doesn't exist yet

CREATE OR REPLACE FUNCTION get_next_message_no(
  p_workspace_id UUID,
  p_channel_id UUID
) RETURNS BIGINT AS $$
DECLARE
  next_no BIGINT;
BEGIN
  INSERT INTO channel_sequences (workspace_id, channel_id, last_message_no)
  VALUES (p_workspace_id, p_channel_id, 1)
  ON CONFLICT (workspace_id, channel_id)
  DO UPDATE SET
    last_message_no = channel_sequences.last_message_no + 1,
    updated_at = NOW()
  RETURNING last_message_no INTO next_no;

  RETURN next_no;
END;
$$ LANGUAGE plpgsql;

-- Usage example:
-- SELECT get_next_message_no('550e8400-e29b-41d4-a716-446655440000'::uuid, '550e8400-e29b-41d4-a716-446655440001'::uuid);
