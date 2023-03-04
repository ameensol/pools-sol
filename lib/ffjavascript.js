// source: https://github.com/iden3/ffjavascript/blob/90a35f4988331364a78dee3f3237577385357ee9/build/main.cjs#L43
// I modified this file to use ethers `randomBytes` instead of the node-native `crypto` module that requires
// a polyfill in browsers. also removed all code that isn't used in the `Scalar` and `ZqField` exports
const { randomBytes } = require("@ethersproject/random");

/* global BigInt */
const hexLen = [0, 1, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4];

function fromString(s, radix) {
    if (!radix || radix == 10) {
        return BigInt(s);
    } else if (radix == 16) {
        if (s.slice(0, 2) == "0x") {
            return BigInt(s);
        } else {
            return BigInt("0x" + s);
        }
    }
}

const e = fromString;

function fromArray(a, radix) {
    let acc = BigInt(0);
    radix = BigInt(radix);
    for (let i = 0; i < a.length; i++) {
        acc = acc * radix + BigInt(a[i]);
    }
    return acc;
}

function bitLength(a) {
    const aS = a.toString(16);
    return (aS.length - 1) * 4 + hexLen[parseInt(aS[0], 16)];
}

function isNegative(a) {
    return BigInt(a) < BigInt(0);
}

function isZero(a) {
    return !a;
}

function shiftLeft(a, n) {
    return BigInt(a) << BigInt(n);
}

function shiftRight(a, n) {
    return BigInt(a) >> BigInt(n);
}

const shl = shiftLeft;
const shr = shiftRight;

function isOdd(a) {
    return (BigInt(a) & BigInt(1)) == BigInt(1);
}

function naf(n) {
    let E = BigInt(n);
    const res = [];
    while (E) {
        if (E & BigInt(1)) {
            const z = 2 - Number(E % BigInt(4));
            res.push(z);
            E = E - BigInt(z);
        } else {
            res.push(0);
        }
        E = E >> BigInt(1);
    }
    return res;
}

function bits(n) {
    let E = BigInt(n);
    const res = [];
    while (E) {
        if (E & BigInt(1)) {
            res.push(1);
        } else {
            res.push(0);
        }
        E = E >> BigInt(1);
    }
    return res;
}

function toNumber(s) {
    if (s > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("Number too big");
    }
    return Number(s);
}

function toArray(s, radix) {
    const res = [];
    let rem = BigInt(s);
    radix = BigInt(radix);
    while (rem) {
        res.unshift(Number(rem % radix));
        rem = rem / radix;
    }
    return res;
}

function add(a, b) {
    return BigInt(a) + BigInt(b);
}

function sub(a, b) {
    return BigInt(a) - BigInt(b);
}

function neg(a) {
    return -BigInt(a);
}

function mul(a, b) {
    return BigInt(a) * BigInt(b);
}

function square(a) {
    return BigInt(a) * BigInt(a);
}

function pow(a, b) {
    return BigInt(a) ** BigInt(b);
}

function exp$1(a, b) {
    return BigInt(a) ** BigInt(b);
}

function abs(a) {
    return BigInt(a) >= 0 ? BigInt(a) : -BigInt(a);
}

function div(a, b) {
    return BigInt(a) / BigInt(b);
}

function mod(a, b) {
    return BigInt(a) % BigInt(b);
}

function eq(a, b) {
    return BigInt(a) == BigInt(b);
}

function neq(a, b) {
    return BigInt(a) != BigInt(b);
}

function lt(a, b) {
    return BigInt(a) < BigInt(b);
}

function gt(a, b) {
    return BigInt(a) > BigInt(b);
}

function leq(a, b) {
    return BigInt(a) <= BigInt(b);
}

function geq(a, b) {
    return BigInt(a) >= BigInt(b);
}

function band(a, b) {
    return BigInt(a) & BigInt(b);
}

function bor(a, b) {
    return BigInt(a) | BigInt(b);
}

function bxor(a, b) {
    return BigInt(a) ^ BigInt(b);
}

function land(a, b) {
    return BigInt(a) && BigInt(b);
}

function lor(a, b) {
    return BigInt(a) || BigInt(b);
}

function lnot(a) {
    return !BigInt(a);
}

// Returns a buffer with Little Endian Representation
function toRprLE(buff, o, e, n8) {
    const s = "0000000" + e.toString(16);
    const v = new Uint32Array(buff.buffer, o, n8 / 4);
    const l = (((s.length - 7) * 4 - 1) >> 5) + 1; // Number of 32bit words;
    for (let i = 0; i < l; i++)
        v[i] = parseInt(
            s.substring(s.length - 8 * i - 8, s.length - 8 * i),
            16
        );
    for (let i = l; i < v.length; i++) v[i] = 0;
    for (let i = v.length * 4; i < n8; i++)
        buff[i] = toNumber(band(shiftRight(e, i * 8), 0xff));
}

// Returns a buffer with Big Endian Representation
function toRprBE(buff, o, e, n8) {
    const s = "0000000" + e.toString(16);
    const v = new DataView(buff.buffer, buff.byteOffset + o, n8);
    const l = (((s.length - 7) * 4 - 1) >> 5) + 1; // Number of 32bit words;
    for (let i = 0; i < l; i++)
        v.setUint32(
            n8 - i * 4 - 4,
            parseInt(s.substring(s.length - 8 * i - 8, s.length - 8 * i), 16),
            false
        );
    for (let i = 0; i < n8 / 4 - l; i++) v[i] = 0;
}

// Pases a buffer with Little Endian Representation
function fromRprLE(buff, o, n8) {
    n8 = n8 || buff.byteLength;
    o = o || 0;
    const v = new Uint32Array(buff.buffer, o, n8 / 4);
    const a = new Array(n8 / 4);
    v.forEach(
        (ch, i) => (a[a.length - i - 1] = ch.toString(16).padStart(8, "0"))
    );
    return fromString(a.join(""), 16);
}

// Pases a buffer with Big Endian Representation
function fromRprBE(buff, o, n8) {
    n8 = n8 || buff.byteLength;
    o = o || 0;
    const v = new DataView(buff.buffer, buff.byteOffset + o, n8);
    const a = new Array(n8 / 4);
    for (let i = 0; i < n8 / 4; i++) {
        a[i] = v
            .getUint32(i * 4, false)
            .toString(16)
            .padStart(8, "0");
    }
    return fromString(a.join(""), 16);
}

function toString(a, radix) {
    return a.toString(radix);
}

function toLEBuff(a) {
    const buff = new Uint8Array(Math.floor((bitLength(a) - 1) / 8) + 1);
    toRprLE(buff, 0, a, buff.byteLength);
    return buff;
}

const zero = e(0);
const one = e(1);

var Scalar = /*#__PURE__*/ Object.freeze({
    __proto__: null,
    fromString: fromString,
    e: e,
    fromArray: fromArray,
    bitLength: bitLength,
    isNegative: isNegative,
    isZero: isZero,
    shiftLeft: shiftLeft,
    shiftRight: shiftRight,
    shl: shl,
    shr: shr,
    isOdd: isOdd,
    naf: naf,
    bits: bits,
    toNumber: toNumber,
    toArray: toArray,
    add: add,
    sub: sub,
    neg: neg,
    mul: mul,
    square: square,
    pow: pow,
    exp: exp$1,
    abs: abs,
    div: div,
    mod: mod,
    eq: eq,
    neq: neq,
    lt: lt,
    gt: gt,
    leq: leq,
    geq: geq,
    band: band,
    bor: bor,
    bxor: bxor,
    land: land,
    lor: lor,
    lnot: lnot,
    toRprLE: toRprLE,
    toRprBE: toRprBE,
    fromRprLE: fromRprLE,
    fromRprBE: fromRprBE,
    toString: toString,
    toLEBuff: toLEBuff,
    zero: zero,
    one: one
});

function exp(F, base, e) {
    if (isZero(e)) return F.one;

    const n = bits(e);

    if (n.length == 0) return F.one;

    let res = base;

    for (let i = n.length - 2; i >= 0; i--) {
        res = F.square(res);

        if (n[i]) {
            res = F.mul(res, base);
        }
    }

    return res;
}

// Check here: https://eprint.iacr.org/2012/685.pdf

function buildSqrt(F) {
    if (F.m % 2 == 1) {
        if (eq(mod(F.p, 4), 1)) {
            if (eq(mod(F.p, 8), 1)) {
                if (eq(mod(F.p, 16), 1)) {
                    // alg7_muller(F);
                    alg5_tonelliShanks(F);
                } else if (eq(mod(F.p, 16), 9)) {
                    alg4_kong(F);
                } else {
                    throw new Error("Field withot sqrt");
                }
            } else if (eq(mod(F.p, 8), 5)) {
                alg3_atkin(F);
            } else {
                throw new Error("Field withot sqrt");
            }
        } else if (eq(mod(F.p, 4), 3)) {
            alg2_shanks(F);
        }
    } else {
        const pm2mod4 = mod(pow(F.p, F.m / 2), 4);
        if (pm2mod4 == 1) {
            alg10_adj(F);
        } else if (pm2mod4 == 3) {
            alg9_adj(F);
        } else {
            alg8_complex(F);
        }
    }
}

function alg5_tonelliShanks(F) {
    F.sqrt_q = pow(F.p, F.m);

    F.sqrt_s = 0;
    F.sqrt_t = sub(F.sqrt_q, 1);

    while (!isOdd(F.sqrt_t)) {
        F.sqrt_s = F.sqrt_s + 1;
        F.sqrt_t = div(F.sqrt_t, 2);
    }

    let c0 = F.one;

    while (F.eq(c0, F.one)) {
        const c = F.random();
        F.sqrt_z = F.pow(c, F.sqrt_t);
        c0 = F.pow(F.sqrt_z, 2 ** (F.sqrt_s - 1));
    }

    F.sqrt_tm1d2 = div(sub(F.sqrt_t, 1), 2);

    F.sqrt = function (a) {
        const F = this;
        if (F.isZero(a)) return F.zero;
        let w = F.pow(a, F.sqrt_tm1d2);
        const a0 = F.pow(F.mul(F.square(w), a), 2 ** (F.sqrt_s - 1));
        if (F.eq(a0, F.negone)) return null;

        let v = F.sqrt_s;
        let x = F.mul(a, w);
        let b = F.mul(x, w);
        let z = F.sqrt_z;
        while (!F.eq(b, F.one)) {
            let b2k = F.square(b);
            let k = 1;
            while (!F.eq(b2k, F.one)) {
                b2k = F.square(b2k);
                k++;
            }

            w = z;
            for (let i = 0; i < v - k - 1; i++) {
                w = F.square(w);
            }
            z = F.square(w);
            b = F.mul(b, z);
            x = F.mul(x, w);
            v = k;
        }
        return F.geq(x, F.zero) ? x : F.neg(x);
    };
}

function alg4_kong(F) {
    F.sqrt = function () {
        throw new Error("Sqrt alg 4 not implemented");
    };
}

function alg3_atkin(F) {
    F.sqrt = function () {
        throw new Error("Sqrt alg 3 not implemented");
    };
}

function alg2_shanks(F) {
    F.sqrt_q = pow(F.p, F.m);
    F.sqrt_e1 = div(sub(F.sqrt_q, 3), 4);

    F.sqrt = function (a) {
        if (this.isZero(a)) return this.zero;

        // Test that have solution
        const a1 = this.pow(a, this.sqrt_e1);

        const a0 = this.mul(this.square(a1), a);

        if (this.eq(a0, this.negone)) return null;

        const x = this.mul(a1, a);

        return F.geq(x, F.zero) ? x : F.neg(x);
    };
}

function alg10_adj(F) {
    F.sqrt = function () {
        throw new Error("Sqrt alg 10 not implemented");
    };
}

function alg9_adj(F) {
    F.sqrt_q = pow(F.p, F.m / 2);
    F.sqrt_e34 = div(sub(F.sqrt_q, 3), 4);
    F.sqrt_e12 = div(sub(F.sqrt_q, 1), 2);

    F.frobenius = function (n, x) {
        if (n % 2 == 1) {
            return F.conjugate(x);
        } else {
            return x;
        }
    };

    F.sqrt = function (a) {
        const F = this;
        const a1 = F.pow(a, F.sqrt_e34);
        const alfa = F.mul(F.square(a1), a);
        const a0 = F.mul(F.frobenius(1, alfa), alfa);
        if (F.eq(a0, F.negone)) return null;
        const x0 = F.mul(a1, a);
        let x;
        if (F.eq(alfa, F.negone)) {
            x = F.mul(x0, [F.F.zero, F.F.one]);
        } else {
            const b = F.pow(F.add(F.one, alfa), F.sqrt_e12);
            x = F.mul(b, x0);
        }
        return F.geq(x, F.zero) ? x : F.neg(x);
    };
}

function alg8_complex(F) {
    F.sqrt = function () {
        throw new Error("Sqrt alg 8 not implemented");
    };
}

/*
    Copyright 2018 0kims association.

    This file is part of snarkjs.

    snarkjs is a free software: you can redistribute it and/or
    modify it under the terms of the GNU General Public License as published by the
    Free Software Foundation, either version 3 of the License, or (at your option)
    any later version.

    snarkjs is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
    more details.

    You should have received a copy of the GNU General Public License along with
    snarkjs. If not, see <https://www.gnu.org/licenses/>.
*/

/*
    This library does operations on polynomials with coefficients in a field F.

    A polynomial P(x) = p0 + p1 * x + p2 * x^2 + ... + pn * x^n  is represented
    by the array [ p0, p1, p2, ... , pn ].
 */

class FFT {
    constructor(G, F, opMulGF) {
        this.F = F;
        this.G = G;
        this.opMulGF = opMulGF;

        let rem = F.sqrt_t || F.t;
        let s = F.sqrt_s || F.s;

        let nqr = F.one;
        while (F.eq(F.pow(nqr, F.half), F.one)) nqr = F.add(nqr, F.one);

        this.w = new Array(s + 1);
        this.wi = new Array(s + 1);
        this.w[s] = this.F.pow(nqr, rem);
        this.wi[s] = this.F.inv(this.w[s]);

        let n = s - 1;
        while (n >= 0) {
            this.w[n] = this.F.square(this.w[n + 1]);
            this.wi[n] = this.F.square(this.wi[n + 1]);
            n--;
        }

        this.roots = [];
        /*
        for (let i=0; i<16; i++) {
            let r = this.F.one;
            n = 1 << i;
            const rootsi = new Array(n);
            for (let j=0; j<n; j++) {
                rootsi[j] = r;
                r = this.F.mul(r, this.w[i]);
            }

            this.roots.push(rootsi);
        }
        */
        this._setRoots(Math.min(s, 15));
    }

    _setRoots(n) {
        for (let i = n; i >= 0 && !this.roots[i]; i--) {
            let r = this.F.one;
            const nroots = 1 << i;
            const rootsi = new Array(nroots);
            for (let j = 0; j < nroots; j++) {
                rootsi[j] = r;
                r = this.F.mul(r, this.w[i]);
            }

            this.roots[i] = rootsi;
        }
    }

    fft(p) {
        if (p.length <= 1) return p;
        const bits = log2$1(p.length - 1) + 1;
        this._setRoots(bits);

        const m = 1 << bits;
        if (p.length != m) {
            throw new Error("Size must be multiple of 2");
        }
        const res = __fft(this, p, bits, 0, 1);
        return res;
    }

    ifft(p) {
        if (p.length <= 1) return p;
        const bits = log2$1(p.length - 1) + 1;
        this._setRoots(bits);
        const m = 1 << bits;
        if (p.length != m) {
            throw new Error("Size must be multiple of 2");
        }
        const res = __fft(this, p, bits, 0, 1);
        const twoinvm = this.F.inv(this.F.mulScalar(this.F.one, m));
        const resn = new Array(m);
        for (let i = 0; i < m; i++) {
            resn[i] = this.opMulGF(res[(m - i) % m], twoinvm);
        }

        return resn;
    }
}

function log2$1(V) {
    return (
        ((V & 0xffff0000) !== 0 ? ((V &= 0xffff0000), 16) : 0) |
        ((V & 0xff00ff00) !== 0 ? ((V &= 0xff00ff00), 8) : 0) |
        ((V & 0xf0f0f0f0) !== 0 ? ((V &= 0xf0f0f0f0), 4) : 0) |
        ((V & 0xcccccccc) !== 0 ? ((V &= 0xcccccccc), 2) : 0) |
        ((V & 0xaaaaaaaa) !== 0)
    );
}

function __fft(PF, pall, bits, offset, step) {
    const n = 1 << bits;
    if (n == 1) {
        return [pall[offset]];
    } else if (n == 2) {
        return [
            PF.G.add(pall[offset], pall[offset + step]),
            PF.G.sub(pall[offset], pall[offset + step])
        ];
    }

    const ndiv2 = n >> 1;
    const p1 = __fft(PF, pall, bits - 1, offset, step * 2);
    const p2 = __fft(PF, pall, bits - 1, offset + step, step * 2);

    const out = new Array(n);

    for (let i = 0; i < ndiv2; i++) {
        out[i] = PF.G.add(p1[i], PF.opMulGF(p2[i], PF.roots[bits][i]));
        out[i + ndiv2] = PF.G.sub(p1[i], PF.opMulGF(p2[i], PF.roots[bits][i]));
    }

    return out;
}

class ZqField {
    constructor(p) {
        this.type = "F1";
        this.one = BigInt(1);
        this.zero = BigInt(0);
        this.p = BigInt(p);
        this.m = 1;
        this.negone = this.p - this.one;
        this.two = BigInt(2);
        this.half = this.p >> this.one;
        this.bitLength = bitLength(this.p);
        this.mask = (this.one << BigInt(this.bitLength)) - this.one;

        this.n64 = Math.floor((this.bitLength - 1) / 64) + 1;
        this.n32 = this.n64 * 2;
        this.n8 = this.n64 * 8;
        this.R = this.e(this.one << BigInt(this.n64 * 64));
        this.Ri = this.inv(this.R);

        const e = this.negone >> this.one;
        this.nqr = this.two;
        let r = this.pow(this.nqr, e);
        while (!this.eq(r, this.negone)) {
            this.nqr = this.nqr + this.one;
            r = this.pow(this.nqr, e);
        }

        this.s = 0;
        this.t = this.negone;

        while ((this.t & this.one) == this.zero) {
            this.s = this.s + 1;
            this.t = this.t >> this.one;
        }

        this.nqr_to_t = this.pow(this.nqr, this.t);

        buildSqrt(this);

        this.FFT = new FFT(this, this, this.mul.bind(this));

        this.fft = this.FFT.fft.bind(this.FFT);
        this.ifft = this.FFT.ifft.bind(this.FFT);
        this.w = this.FFT.w;
        this.wi = this.FFT.wi;

        this.shift = this.square(this.nqr);
        this.k = this.exp(this.nqr, 2 ** this.s);
    }

    e(a, b) {
        let res;
        if (!b) {
            res = BigInt(a);
        } else if (b == 16) {
            res = BigInt("0x" + a);
        }
        if (res < 0) {
            let nres = -res;
            if (nres >= this.p) nres = nres % this.p;
            return this.p - nres;
        } else {
            return res >= this.p ? res % this.p : res;
        }
    }

    add(a, b) {
        const res = a + b;
        return res >= this.p ? res - this.p : res;
    }

    sub(a, b) {
        return a >= b ? a - b : this.p - b + a;
    }

    neg(a) {
        return a ? this.p - a : a;
    }

    mul(a, b) {
        return (a * b) % this.p;
    }

    mulScalar(base, s) {
        return (base * this.e(s)) % this.p;
    }

    square(a) {
        return (a * a) % this.p;
    }

    eq(a, b) {
        return a == b;
    }

    neq(a, b) {
        return a != b;
    }

    lt(a, b) {
        const aa = a > this.half ? a - this.p : a;
        const bb = b > this.half ? b - this.p : b;
        return aa < bb;
    }

    gt(a, b) {
        const aa = a > this.half ? a - this.p : a;
        const bb = b > this.half ? b - this.p : b;
        return aa > bb;
    }

    leq(a, b) {
        const aa = a > this.half ? a - this.p : a;
        const bb = b > this.half ? b - this.p : b;
        return aa <= bb;
    }

    geq(a, b) {
        const aa = a > this.half ? a - this.p : a;
        const bb = b > this.half ? b - this.p : b;
        return aa >= bb;
    }

    div(a, b) {
        return this.mul(a, this.inv(b));
    }

    idiv(a, b) {
        if (!b) throw new Error("Division by zero");
        return a / b;
    }

    inv(a) {
        if (!a) throw new Error("Division by zero");

        let t = this.zero;
        let r = this.p;
        let newt = this.one;
        let newr = a % this.p;
        while (newr) {
            let q = r / newr;
            [t, newt] = [newt, t - q * newt];
            [r, newr] = [newr, r - q * newr];
        }
        if (t < this.zero) t += this.p;
        return t;
    }

    mod(a, b) {
        return a % b;
    }

    pow(b, e) {
        return exp(this, b, e);
    }

    exp(b, e) {
        return exp(this, b, e);
    }

    band(a, b) {
        const res = a & b & this.mask;
        return res >= this.p ? res - this.p : res;
    }

    bor(a, b) {
        const res = (a | b) & this.mask;
        return res >= this.p ? res - this.p : res;
    }

    bxor(a, b) {
        const res = (a ^ b) & this.mask;
        return res >= this.p ? res - this.p : res;
    }

    bnot(a) {
        const res = a ^ this.mask;
        return res >= this.p ? res - this.p : res;
    }

    shl(a, b) {
        if (Number(b) < this.bitLength) {
            const res = (a << b) & this.mask;
            return res >= this.p ? res - this.p : res;
        } else {
            const nb = this.p - b;
            if (Number(nb) < this.bitLength) {
                return a >> nb;
            } else {
                return this.zero;
            }
        }
    }

    shr(a, b) {
        if (Number(b) < this.bitLength) {
            return a >> b;
        } else {
            const nb = this.p - b;
            if (Number(nb) < this.bitLength) {
                const res = (a << nb) & this.mask;
                return res >= this.p ? res - this.p : res;
            } else {
                return 0;
            }
        }
    }

    land(a, b) {
        return a && b ? this.one : this.zero;
    }

    lor(a, b) {
        return a || b ? this.one : this.zero;
    }

    lnot(a) {
        return a ? this.zero : this.one;
    }

    sqrt_old(n) {
        if (n == this.zero) return this.zero;

        // Test that have solution
        const res = this.pow(n, this.negone >> this.one);
        if (res != this.one) return null;

        let m = this.s;
        let c = this.nqr_to_t;
        let t = this.pow(n, this.t);
        let r = this.pow(n, this.add(this.t, this.one) >> this.one);

        while (t != this.one) {
            let sq = this.square(t);
            let i = 1;
            while (sq != this.one) {
                i++;
                sq = this.square(sq);
            }

            // b = c ^ m-i-1
            let b = c;
            for (let j = 0; j < m - i - 1; j++) b = this.square(b);

            m = i;
            c = this.square(b);
            t = this.mul(t, c);
            r = this.mul(r, b);
        }

        if (r > this.p >> this.one) {
            r = this.neg(r);
        }

        return r;
    }

    normalize(a, b) {
        a = BigInt(a, b);
        if (a < 0) {
            let na = -a;
            if (na >= this.p) na = na % this.p;
            return this.p - na;
        } else {
            return a >= this.p ? a % this.p : a;
        }
    }

    random() {
        const nBytes = (this.bitLength * 2) / 8;
        let res = this.zero;
        for (let i = 0; i < nBytes; i++) {
            res = (res << BigInt(8)) + BigInt(randomBytes(1)[0]);
        }
        return res % this.p;
    }

    toString(a, base) {
        base = base || 10;
        let vs;
        if (a > this.half && base == 10) {
            const v = this.p - a;
            vs = "-" + v.toString(base);
        } else {
            vs = a.toString(base);
        }
        return vs;
    }

    isZero(a) {
        return a == this.zero;
    }

    fromRng(rng) {
        let v;
        do {
            v = this.zero;
            for (let i = 0; i < this.n64; i++) {
                v += rng.nextU64() << BigInt(64 * i);
            }
            v &= this.mask;
        } while (v >= this.p);
        v = (v * this.Ri) % this.p; // Convert from montgomery
        return v;
    }

    fft(a) {
        return this.FFT.fft(a);
    }

    ifft(a) {
        return this.FFT.ifft(a);
    }

    // Returns a buffer with Little Endian Representation
    toRprLE(buff, o, e) {
        toRprLE(buff, o, e, this.n64 * 8);
    }

    // Returns a buffer with Big Endian Representation
    toRprBE(buff, o, e) {
        toRprBE(buff, o, e, this.n64 * 8);
    }

    // Returns a buffer with Big Endian Montgomery Representation
    toRprBEM(buff, o, e) {
        return this.toRprBE(buff, o, this.mul(this.R, e));
    }

    toRprLEM(buff, o, e) {
        return this.toRprLE(buff, o, this.mul(this.R, e));
    }

    // Pases a buffer with Little Endian Representation
    fromRprLE(buff, o) {
        return fromRprLE(buff, o, this.n8);
    }

    // Pases a buffer with Big Endian Representation
    fromRprBE(buff, o) {
        return fromRprBE(buff, o, this.n8);
    }

    fromRprLEM(buff, o) {
        return this.mul(this.fromRprLE(buff, o), this.Ri);
    }

    fromRprBEM(buff, o) {
        return this.mul(this.fromRprBE(buff, o), this.Ri);
    }

    toObject(a) {
        return a;
    }
}

exports.Scalar = Scalar;
exports.ZqField = ZqField;

Object.assign(module.exports, {
    Scalar,
    ZqField
});
