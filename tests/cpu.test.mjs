import assert from "node:assert/strict";
import { test } from "node:test";
import { assembleSource } from "../src/lib/assembler/index.ts";
import {
  createCpu, decodeInstruction, fetchInstruction, getCpuSnapshot, loadProgram, readMemory,
  resetCpu, setExecutionLimit, writeMemory, writeRegister, isSignedWord, isMemoryAddress,
  isValidPc, isValidSp, isValidImageSize, isValidExecutionLimit, isValidRegisterValue,
} from "../src/lib/cpu/index.ts";
import { MEMORY_WORDS } from "../src/lib/assembler/isa.ts";

const registers = { A: 0, B: 0, PC: 0, SP: 65536 };
function value(result) {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.value;
}
function error(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.diagnostic.code, code);
  assert.equal(result.diagnostic.severity, "error");
  assert.equal("value" in result, false);
  return result.diagnostic;
}
function program(source) {
  const result = assembleSource(source);
  assert.equal(result.status, "success", JSON.stringify(result.diagnostics));
  return result.program;
}
const image = (bytes, origin = 0) => ({ bytes, origin, sourceMap: [] });

test("cold CPU has exact registers, independent zero-filled signed memory, and idle bookkeeping", () => {
  const cpu = createCpu();
  const state = getCpuSnapshot(cpu);
  assert.deepEqual(state.registers, registers);
  assert.ok(state.memory instanceof Int32Array);
  assert.equal(state.memory.length, MEMORY_WORDS);
  assert.ok(state.memory.every((word) => word === 0));
  assert.equal(state.status, "idle");
  assert.equal(state.attemptedInstructions, 0);
  assert.deepEqual(state.limits, { maxInstructions: 100000 });
  assert.equal(state.program, null);
  assert.deepEqual(state.diagnostics, []);
  assert.deepEqual(state.trace, []);
  value(writeMemory(cpu, 0, 1));
  assert.equal(value(readMemory(createCpu(), 0)), 0);
});

test("cold reset is repeatable and does not invent a loaded image", () => {
  const cpu = createCpu();
  const before = getCpuSnapshot(cpu);
  value(writeMemory(cpu, 65535, -1));
  value(writeRegister(cpu, "A", 7));
  resetCpu(cpu);
  assert.deepEqual(getCpuSnapshot(cpu), before);
  resetCpu(cpu);
  assert.deepEqual(getCpuSnapshot(cpu), before);
});

test("HALT loads as ready and fetching it does not execute or halt the CPU", () => {
  const cpu = createCpu();
  const binary = program("HALT");
  value(loadProgram(cpu, binary));
  const before = getCpuSnapshot(cpu);
  assert.deepEqual(before.registers, registers);
  assert.equal(before.status, "ready");
  assert.equal(value(readMemory(cpu, 0)), 18);
  assert.equal(before.attemptedInstructions, 0);
  assert.deepEqual(value(fetchInstruction(cpu)), { word: 18, opcode: 18, mnemonic: "HALT", operand: 0 });
  assert.deepEqual(getCpuSnapshot(cpu), before);
});

test("loader reads exact little-endian signed words including full-width data", () => {
  const cpu = createCpu();
  value(loadProgram(cpu, image(new Uint8Array([0, 10, 0, 0, 0x11, 0xff, 0xff, 0xff, 0, 0, 0, 128, 255, 255, 255, 127]))));
  assert.deepEqual([0, 1, 2, 3].map((address) => value(readMemory(cpu, address))), [2560, -239, -2147483648, 2147483647]);
  assert.equal(value(readMemory(cpu, 4)), 0);
});

test("loading a new shorter image clears old words and manual state", () => {
  const cpu = createCpu();
  value(loadProgram(cpu, program("data -1\ndata -2\ndata -3")));
  value(writeMemory(cpu, 65535, 88));
  value(writeRegister(cpu, "A", -12));
  value(writeRegister(cpu, "B", 9));
  value(writeRegister(cpu, "PC", 2));
  value(writeRegister(cpu, "SP", 0));
  value(loadProgram(cpu, program("HALT")));
  const state = getCpuSnapshot(cpu);
  assert.deepEqual(state.registers, registers);
  assert.equal(state.memory[0], 18);
  assert.ok(state.memory.subarray(1).every((word) => word === 0));
  assert.equal(state.status, "ready");
  assert.equal(state.attemptedInstructions, 0);
});

test("an empty loaded image clears memory and remains idle on reset", () => {
  const cpu = createCpu();
  value(loadProgram(cpu, program("HALT")));
  value(loadProgram(cpu, program("")));
  const before = getCpuSnapshot(cpu);
  assert.equal(before.status, "idle");
  assert.ok(before.memory.every((word) => word === 0));
  assert.deepEqual(before.registers, registers);
  assert.equal(before.program.bytes.length, 0);
  resetCpu(cpu);
  assert.deepEqual(getCpuSnapshot(cpu), before);
});

test("loader accepts data with invalid instruction bits and defers decoding errors", () => {
  const cpu = createCpu();
  value(loadProgram(cpu, program("data -1\ndata 262\ndata 0")));
  const before = getCpuSnapshot(cpu);
  const invalidOpcode = error(fetchInstruction(cpu), "C002_INVALID_OPCODE");
  assert.equal(invalidOpcode.word, -1);
  assert.equal(invalidOpcode.address, 0);
  const invalidEncoding = error(fetchInstruction(cpu, 1), "C003_INVALID_ENCODING");
  assert.equal(invalidEncoding.word, 262);
  assert.equal(invalidEncoding.address, 1);
  assert.deepEqual(value(fetchInstruction(cpu, 2)), { word: 0, opcode: 0, mnemonic: "ldc", operand: 0 });
  assert.deepEqual(getCpuSnapshot(cpu), before);
});

// Fixed ISA bit patterns, not computed from the decoder or metadata.
for (const [word, opcode, mnemonic, operand] of [
  [0x00000a00, 0, "ldc", 10], [0x00000501, 1, "adc", 5], [0xfffffe02, 2, "ldl", -2],
  [0x00000303, 3, "stl", 3], [0x00000404, 4, "ldnl", 4], [0xfffffb05, 5, "stnl", -5],
  [6, 6, "add", 0], [7, 7, "sub", 0], [8, 8, "shl", 0], [9, 9, "shr", 0],
  [0xffffff0a, 10, "adj", -1], [11, 11, "a2sp", 0], [12, 12, "sp2a", 0],
  [13, 13, "call", 0], [14, 14, "return", 0], [0x0000010f, 15, "brz", 1],
  [0xfffffe10, 16, "brlz", -2], [0xffffff11, 17, "br", -1], [18, 18, "HALT", 0],
]) {
  test(`decoder recognizes opcode ${opcode} (${mnemonic}) and preserves its word`, () => {
    assert.deepEqual(value(decodeInstruction(word)), { word, opcode, mnemonic, operand });
  });
}

test("decoder sign-extends all operand boundary patterns and accepts signed/unsigned words", () => {
  for (const [word, operand] of [[0x80000000, -8388608], [-2147483648, -8388608], [0x7fffff00, 8388607], [0xffffff00, -1], [-256, -1], [0, 0]]) {
    const decoded = value(decodeInstruction(word));
    assert.equal(decoded.operand, operand);
    assert.equal(decoded.word, word);
  }
});

test("decoder rejects every unsupported opcode from 19 through 255", () => {
  for (let opcode = 19; opcode <= 255; opcode++) {
    const diagnostic = error(decodeInstruction(opcode), "C002_INVALID_OPCODE");
    assert.equal(diagnostic.word, opcode);
    assert.match(diagnostic.message, new RegExp(`Opcode ${opcode} `));
  }
});

test("all eight operand-free opcodes reject positive and negative payloads", () => {
  for (const opcode of [6, 7, 8, 9, 11, 12, 14, 18]) {
    for (const word of [256 + opcode, 0xffffff00 + opcode, 0x80000000 + opcode]) {
      assert.equal(error(decodeInstruction(word), "C003_INVALID_ENCODING").word, word);
    }
  }
});

test("decoder rejects values that would otherwise be coerced or truncated", () => {
  for (const word of [-2147483649, 4294967296, 1.5, NaN, Infinity, -Infinity, "18", null]) {
    error(decodeInstruction(word), "C001_INVALID_WORD");
  }
});

test("fetch is word-addressed, follows PC, and never advances or counts attempts", () => {
  const cpu = createCpu();
  value(loadProgram(cpu, program("ldc 10\nadc -2\nHALT")));
  value(writeRegister(cpu, "PC", 1));
  const before = getCpuSnapshot(cpu);
  assert.deepEqual(value(fetchInstruction(cpu)), { word: -511, opcode: 1, mnemonic: "adc", operand: -2 });
  assert.deepEqual(value(fetchInstruction(cpu, 2)), { word: 18, opcode: 18, mnemonic: "HALT", operand: 0 });
  assert.deepEqual(getCpuSnapshot(cpu), before);
});

test("fetch may inspect zero-filled memory outside the loaded image without making it runnable", () => {
  const cpu = createCpu();
  value(writeRegister(cpu, "PC", 65535));
  const before = getCpuSnapshot(cpu);
  assert.deepEqual(value(fetchInstruction(cpu)), { word: 0, opcode: 0, mnemonic: "ldc", operand: 0 });
  assert.deepEqual(getCpuSnapshot(cpu), before);
  assert.equal(before.status, "idle");
});

test("invalid fetch addresses report structured PC errors without state changes", () => {
  const cpu = createCpu();
  const before = getCpuSnapshot(cpu);
  for (const address of [-1, 65536, 0.5, NaN, Infinity, 4294967296, "0", null]) {
    const diagnostic = error(fetchInstruction(cpu, address), "C004_INVALID_PC");
    assert.equal(diagnostic.address, address);
  }
  assert.deepEqual(getCpuSnapshot(cpu), before);
});

test("misaligned and oversized images fail atomically, retaining the last reset image", () => {
  const cpu = createCpu();
  value(loadProgram(cpu, program("ldc 10\nHALT")));
  value(writeMemory(cpu, 0, -77));
  value(writeMemory(cpu, 100, 88));
  value(writeRegister(cpu, "A", -4));
  value(writeRegister(cpu, "PC", 1));
  value(setExecutionLimit(cpu, 5));
  const before = getCpuSnapshot(cpu);
  for (const length of [1, 2, 3, 5, MEMORY_WORDS * 4 + 4]) {
    error(loadProgram(cpu, image(new Uint8Array(length))), "C009_INVALID_IMAGE_SIZE");
    assert.deepEqual(getCpuSnapshot(cpu), before);
  }
  resetCpu(cpu);
  assert.equal(value(readMemory(cpu, 0)), 2560);
  assert.equal(value(readMemory(cpu, 1)), 18);
  assert.equal(value(readMemory(cpu, 100)), 0);
  assert.deepEqual(getCpuSnapshot(cpu).registers, registers);
});

test("unsupported origins and wrong byte containers do not mutate an existing CPU", () => {
  const cpu = createCpu();
  value(loadProgram(cpu, program("HALT")));
  const before = getCpuSnapshot(cpu);
  for (const origin of [-1, 1, 65536, 0.5, NaN, Infinity, "0", null]) {
    error(loadProgram(cpu, image(new Uint8Array(4), origin)), "C008_INVALID_ORIGIN");
  }
  for (const bytes of [[], new Int32Array(1), new ArrayBuffer(4), null]) {
    error(loadProgram(cpu, image(bytes)), "C011_INVALID_IMAGE_TYPE");
  }
  assert.deepEqual(getCpuSnapshot(cpu), before);
});

test("exactly 65,536 words load without truncating the final address", () => {
  const cpu = createCpu();
  const bytes = new Uint8Array(MEMORY_WORDS * 4);
  const view = new DataView(bytes.buffer);
  view.setInt32(0, 18, true);
  view.setInt32(4, -2147483648, true);
  view.setInt32(bytes.length - 4, 2147483647, true);
  value(loadProgram(cpu, image(bytes)));
  const state = getCpuSnapshot(cpu);
  assert.equal(state.memory[0], 18);
  assert.equal(state.memory[1], -2147483648);
  assert.ok(state.memory.subarray(2, -1).every((word) => word === 0));
  assert.equal(state.memory[65535], 2147483647);
  assert.equal(state.status, "ready");
  assert.equal(state.program.bytes.length, 262144);
});

test("loader copies input bytes and nested source metadata without mutating either", () => {
  const cpu = createCpu();
  const binary = program("entry: ldc 10\nHALT");
  const original = structuredClone(binary);
  value(loadProgram(cpu, binary));
  assert.deepEqual(binary, original);
  binary.bytes.fill(255);
  binary.sourceMap[0].source.start.column = 900;
  binary.sourceMap[0].offset = 100;
  value(writeMemory(cpu, 0, -9));
  resetCpu(cpu);
  assert.equal(value(readMemory(cpu, 0)), 2560);
  assert.deepEqual(getCpuSnapshot(cpu).program, original);
});

test("loader respects Uint8Array view offsets and owns Buffer input independently", () => {
  const cpu = createCpu();
  const backing = new Uint8Array([255, 255, 0, 10, 0, 0, 255, 255]);
  value(loadProgram(cpu, image(backing.subarray(2, 6))));
  assert.equal(value(readMemory(cpu, 0)), 2560);
  const buffer = Buffer.from([18, 0, 0, 0]);
  value(loadProgram(cpu, image(buffer)));
  buffer.fill(255);
  resetCpu(cpu);
  assert.equal(value(readMemory(cpu, 0)), 18);
  assert.equal(getCpuSnapshot(cpu).program.bytes.constructor, Uint8Array);
});

test("reset restores the most recently loaded image and clears all mutable machine state", () => {
  const cpu = createCpu();
  value(loadProgram(cpu, program("data 100")));
  const binary = program("ldc 10\nHALT\ndata -1");
  value(loadProgram(cpu, binary));
  const expected = getCpuSnapshot(cpu);
  value(writeRegister(cpu, "A", -2147483648));
  value(writeRegister(cpu, "B", 2147483647));
  value(writeRegister(cpu, "SP", 0));
  value(writeRegister(cpu, "PC", 2));
  value(writeMemory(cpu, 0, 999));
  value(writeMemory(cpu, 65535, -1));
  resetCpu(cpu);
  assert.deepEqual(getCpuSnapshot(cpu), expected);
  resetCpu(cpu);
  assert.deepEqual(getCpuSnapshot(cpu), expected);
  assert.equal(expected.attemptedInstructions, 0);
  assert.deepEqual(expected.diagnostics, []);
  assert.deepEqual(expected.trace, []);
});

test("snapshots cannot corrupt private registers, memory, image, metadata, or configuration", () => {
  const cpu = createCpu();
  value(loadProgram(cpu, program("entry: HALT")));
  const expected = getCpuSnapshot(cpu);
  const snapshot = getCpuSnapshot(cpu);
  snapshot.registers.PC = -1;
  snapshot.memory.fill(-1);
  snapshot.program.bytes.fill(255);
  snapshot.program.sourceMap[0].source.end.column = 800;
  snapshot.limits.maxInstructions = 0;
  snapshot.status = "running";
  snapshot.attemptedInstructions = 100;
  assert.deepEqual(getCpuSnapshot(cpu), expected);
  assert.equal(Object.isFrozen(cpu), true);
  assert.equal("memory" in cpu, false);
});

test("checked memory writes enforce signed values and never wrap addresses", () => {
  const cpu = createCpu();
  value(writeMemory(cpu, 0, -2147483648));
  value(writeMemory(cpu, 65535, 2147483647));
  assert.equal(value(readMemory(cpu, 0)), -2147483648);
  assert.equal(value(readMemory(cpu, 65535)), 2147483647);
  const before = getCpuSnapshot(cpu);
  for (const address of [-1, 65536, 1.5, NaN, Infinity, 4294967296, "0", null]) {
    error(readMemory(cpu, address), "C005_INVALID_ADDRESS");
    error(writeMemory(cpu, address, 1), "C005_INVALID_ADDRESS");
  }
  for (const word of [-2147483649, 2147483648, 4294967295, 1.5, NaN, Infinity]) {
    error(writeMemory(cpu, 0, word), "C007_INVALID_MEMORY_VALUE");
  }
  assert.deepEqual(getCpuSnapshot(cpu), before);
});

test("register setters enforce A/B, PC, and the one-past-end SP boundary", () => {
  const cpu = createCpu();
  value(writeRegister(cpu, "A", -2147483648));
  value(writeRegister(cpu, "B", 2147483647));
  value(writeRegister(cpu, "PC", 65535));
  value(writeRegister(cpu, "SP", 0));
  value(writeRegister(cpu, "SP", 65536));
  assert.deepEqual(getCpuSnapshot(cpu).registers, { A: -2147483648, B: 2147483647, PC: 65535, SP: 65536 });
  const before = getCpuSnapshot(cpu);
  for (const value of [-1, 65536, 0.5, NaN, Infinity]) error(writeRegister(cpu, "PC", value), "C004_INVALID_PC");
  for (const [register, invalid] of [["A", 2147483648], ["B", -2147483649], ["A", 1.5], ["SP", -1], ["SP", 65537], ["SP", 1.5], ["X", 0], ["__proto__", 0]]) {
    error(writeRegister(cpu, register, invalid), "C006_INVALID_REGISTER");
  }
  assert.deepEqual(getCpuSnapshot(cpu), before);
});

test("validation helpers use exact integer boundaries without coercion", () => {
  for (const word of [-2147483648, 0, 2147483647]) assert.equal(isSignedWord(word), true);
  for (const address of [0, 65535]) assert.equal(isMemoryAddress(address) && isValidPc(address), true);
  assert.equal(isValidSp(65536), true);
  assert.equal(isMemoryAddress(65536), false);
  assert.equal(isValidPc(65536), false);
  assert.equal(isValidRegisterValue("SP", 65536), true);
  assert.equal(isValidRegisterValue("A", -2147483648), true);
  for (const invalid of [NaN, Infinity, -Infinity, 0.5, "0", null]) {
    for (const validate of [isSignedWord, isMemoryAddress, isValidPc, isValidSp, isValidImageSize, isValidExecutionLimit]) assert.equal(validate(invalid), false);
  }
  for (const size of [0, 4, 262144]) assert.equal(isValidImageSize(size), true);
  for (const size of [-4, 1, 262148, 4294967296]) assert.equal(isValidImageSize(size), false);
});

test("execution limits validate the full allowed range and persist across load/reset", () => {
  const cpu = createCpu();
  for (const limit of [1, 10000000]) {
    assert.equal(isValidExecutionLimit(limit), true);
    value(setExecutionLimit(cpu, limit));
    assert.equal(getCpuSnapshot(cpu).limits.maxInstructions, limit);
  }
  const before = getCpuSnapshot(cpu);
  for (const limit of [0, -1, 10000001, 1.5, NaN, Infinity, 4295067296]) error(setExecutionLimit(cpu, limit), "C010_INVALID_EXECUTION_LIMIT");
  assert.deepEqual(getCpuSnapshot(cpu), before);
  value(loadProgram(cpu, program("HALT")));
  resetCpu(cpu);
  assert.equal(getCpuSnapshot(cpu).limits.maxInstructions, 10000000);
});

test("assembler to loader to fetch preserves symbolic operands, data, and source metadata", () => {
  const binary = program("start: ldc value\ncall done\nvalue: data -2147483648\ndone: br start\nHALT");
  const original = structuredClone(binary);
  const cpu = createCpu();
  value(loadProgram(cpu, binary));
  assert.deepEqual([0, 1, 2, 3, 4].map((address) => value(readMemory(cpu, address))), [512, 269, -2147483648, -1007, 18]);
  assert.deepEqual(value(fetchInstruction(cpu, 0)), { word: 512, opcode: 0, mnemonic: "ldc", operand: 2 });
  assert.deepEqual(value(fetchInstruction(cpu, 1)), { word: 269, opcode: 13, mnemonic: "call", operand: 1 });
  assert.deepEqual(value(fetchInstruction(cpu, 2)), { word: -2147483648, opcode: 0, mnemonic: "ldc", operand: -8388608 });
  assert.deepEqual(value(fetchInstruction(cpu, 3)), { word: -1007, opcode: 17, mnemonic: "br", operand: -4 });
  assert.deepEqual(getCpuSnapshot(cpu).program.sourceMap, binary.sourceMap);
  assert.deepEqual(binary, original);
  assert.deepEqual(getCpuSnapshot(cpu).registers, registers);
  assert.equal(getCpuSnapshot(cpu).attemptedInstructions, 0);
});
