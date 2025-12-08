-- Test script to verify activity_logs table structure

-- Check if activity_logs table exists and show its structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'activity_logs'
ORDER BY ordinal_position;

-- Check if the 'event' column exists (not 'event_type')
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'activity_logs' 
    AND column_name = 'event'
) as has_event_column;

-- Check if the 'event_type' column still exists (should be false)
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'activity_logs' 
    AND column_name = 'event_type'
) as has_event_type_column;

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'activity_logs';

-- Count existing activity logs
SELECT COUNT(*) as total_logs FROM activity_logs;

-- Show sample of existing logs (if any)
SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 5;
