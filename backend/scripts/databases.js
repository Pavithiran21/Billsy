/**
 * The database names the scripts may touch. MySQL logs in as root, which can reach every
 * database on the server, so every script that creates, drops or empties data checks the name
 * against these lists first (CLAUDE.md, "MySQL login: root").
 */
const DEV_DATABASE = 'billsy';
const TEST_DATABASE = 'billsy_test';
const DEMO_DATABASE = 'billsy_demo';

// db-create.js creates only these (and only if missing).
const CREATABLE_DATABASES = [DEV_DATABASE, TEST_DATABASE, DEMO_DATABASE];
// db-drop.js refuses every other name, so it can never drop the development database.
const DROPPABLE_DATABASES = [TEST_DATABASE, DEMO_DATABASE];

module.exports = { DEV_DATABASE, TEST_DATABASE, DEMO_DATABASE, CREATABLE_DATABASES, DROPPABLE_DATABASES };
