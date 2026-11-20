-- Shared text folding for paginated searches. No extension or data rewrite is required.
CREATE OR REPLACE FUNCTION carehub_search_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT btrim(regexp_replace(
        lower(translate(
            regexp_replace(normalize(coalesce(value, ''), NFD), U&'[\0300-\036f]', '', 'g'),
            'đĐ', 'dD'
        )),
        '[[:space:]]+', ' ', 'g'
    ));
$$;
