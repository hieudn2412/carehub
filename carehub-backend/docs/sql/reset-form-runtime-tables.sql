-- Development/demo reset only. The application recreates these tables from JPA entities
-- because Flyway is intentionally not used in this project.
DROP TABLE IF EXISTS form_answers CASCADE;
DROP TABLE IF EXISTS form_submission_contexts CASCADE;
DROP TABLE IF EXISTS form_submissions CASCADE;
DROP TABLE IF EXISTS form_assignment_items CASCADE;
DROP TABLE IF EXISTS form_assignments CASCADE;
