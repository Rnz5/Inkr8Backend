// Explicit requirement enforcement. Existing characterizations do not approve AC-02.
process.env.CIERRE_EXIGIR_AC02='1';
require('./cierre.ac02.test.cjs');
