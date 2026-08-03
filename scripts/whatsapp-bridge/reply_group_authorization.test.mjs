import assert from 'node:assert/strict';
import { matchesAllowedUser, parseAllowedUsers } from './allowlist.js';

const target = '120363409379784181@g.us';
const other = '120363417170424696@g.us';
const allowedGroups = parseAllowedUsers(target);

assert.equal(matchesAllowedUser(target, allowedGroups, '/tmp/no-session'), true);
assert.equal(matchesAllowedUser(other, allowedGroups, '/tmp/no-session'), false);
assert.equal(matchesAllowedUser('175552795254858@lid', allowedGroups, '/tmp/no-session'), false);

console.log('reply group authorization: PASS');