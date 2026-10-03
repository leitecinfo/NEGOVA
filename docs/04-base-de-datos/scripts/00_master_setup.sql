-- ==============================================================================
-- NEGOVA MVP - SCRIPT MAESTRO DE INICIALIZACIÓN COMPLETA (00_master_setup.sql)
-- Motor: PostgreSQL 15+ / Supabase
-- ==============================================================================

\echo 'Iniciando instalación del esquema de base de datos NEGOVA MVP...'

\i 01_extensions_and_enums.sql
\i 02_core_tables.sql
\i 03_restaurant_tables.sql
\i 04_indexes_and_constraints.sql
\i 05_triggers_and_functions.sql
\i 06_row_level_security.sql
\i 07_seed_initial_data.sql

\echo '¡Instalación completada exitosamente!'
