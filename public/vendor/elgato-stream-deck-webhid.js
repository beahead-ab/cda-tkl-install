// @elgato-stream-deck/webhid 7.7.1 with @elgato-stream-deck/core 7.7.1, MIT License (c) Julian Waller.
// Bundled for the browser without changes: npx esbuild node_modules/@elgato-stream-deck/webhid/dist/index.js --bundle --format=esm --platform=browser --target=es2022
// Default export carries requestStreamDecks, getStreamDecks and openDevice.
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/tslib/tslib.es6.mjs
var tslib_es6_exports = {};
__export(tslib_es6_exports, {
  __addDisposableResource: () => __addDisposableResource,
  __assign: () => __assign,
  __asyncDelegator: () => __asyncDelegator,
  __asyncGenerator: () => __asyncGenerator,
  __asyncValues: () => __asyncValues,
  __await: () => __await,
  __awaiter: () => __awaiter,
  __classPrivateFieldGet: () => __classPrivateFieldGet,
  __classPrivateFieldIn: () => __classPrivateFieldIn,
  __classPrivateFieldSet: () => __classPrivateFieldSet,
  __createBinding: () => __createBinding,
  __decorate: () => __decorate,
  __disposeResources: () => __disposeResources,
  __esDecorate: () => __esDecorate,
  __exportStar: () => __exportStar,
  __extends: () => __extends,
  __generator: () => __generator,
  __importDefault: () => __importDefault,
  __importStar: () => __importStar,
  __makeTemplateObject: () => __makeTemplateObject,
  __metadata: () => __metadata,
  __param: () => __param,
  __propKey: () => __propKey,
  __read: () => __read,
  __rest: () => __rest,
  __rewriteRelativeImportExtension: () => __rewriteRelativeImportExtension,
  __runInitializers: () => __runInitializers,
  __setFunctionName: () => __setFunctionName,
  __spread: () => __spread,
  __spreadArray: () => __spreadArray,
  __spreadArrays: () => __spreadArrays,
  __values: () => __values,
  default: () => tslib_es6_default
});
function __extends(d, b) {
  if (typeof b !== "function" && b !== null)
    throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
  extendStatics(d, b);
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}
function __rest(s, e) {
  var t = {};
  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
    t[p] = s[p];
  if (s != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
        t[p[i]] = s[p[i]];
    }
  return t;
}
function __decorate(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function __param(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
}
function __esDecorate(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
  function accept(f) {
    if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
    return f;
  }
  var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
  var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
  var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
  var _, done = false;
  for (var i = decorators.length - 1; i >= 0; i--) {
    var context = {};
    for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
    for (var p in contextIn.access) context.access[p] = contextIn.access[p];
    context.addInitializer = function(f) {
      if (done) throw new TypeError("Cannot add initializers after decoration has completed");
      extraInitializers.push(accept(f || null));
    };
    var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
    if (kind === "accessor") {
      if (result === void 0) continue;
      if (result === null || typeof result !== "object") throw new TypeError("Object expected");
      if (_ = accept(result.get)) descriptor.get = _;
      if (_ = accept(result.set)) descriptor.set = _;
      if (_ = accept(result.init)) initializers.unshift(_);
    } else if (_ = accept(result)) {
      if (kind === "field") initializers.unshift(_);
      else descriptor[key] = _;
    }
  }
  if (target) Object.defineProperty(target, contextIn.name, descriptor);
  done = true;
}
function __runInitializers(thisArg, initializers, value) {
  var useValue = arguments.length > 2;
  for (var i = 0; i < initializers.length; i++) {
    value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
  }
  return useValue ? value : void 0;
}
function __propKey(x) {
  return typeof x === "symbol" ? x : "".concat(x);
}
function __setFunctionName(f, name, prefix) {
  if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
  return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
}
function __metadata(metadataKey, metadataValue) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
}
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function __generator(thisArg, body) {
  var _ = { label: 0, sent: function() {
    if (t[0] & 1) throw t[1];
    return t[1];
  }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
    return this;
  }), g;
  function verb(n) {
    return function(v) {
      return step([n, v]);
    };
  }
  function step(op) {
    if (f) throw new TypeError("Generator is already executing.");
    while (g && (g = 0, op[0] && (_ = 0)), _) try {
      if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
      if (y = 0, t) op = [op[0] & 2, t.value];
      switch (op[0]) {
        case 0:
        case 1:
          t = op;
          break;
        case 4:
          _.label++;
          return { value: op[1], done: false };
        case 5:
          _.label++;
          y = op[1];
          op = [0];
          continue;
        case 7:
          op = _.ops.pop();
          _.trys.pop();
          continue;
        default:
          if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _ = 0;
            continue;
          }
          if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
            _.label = op[1];
            break;
          }
          if (op[0] === 6 && _.label < t[1]) {
            _.label = t[1];
            t = op;
            break;
          }
          if (t && _.label < t[2]) {
            _.label = t[2];
            _.ops.push(op);
            break;
          }
          if (t[2]) _.ops.pop();
          _.trys.pop();
          continue;
      }
      op = body.call(thisArg, _);
    } catch (e) {
      op = [6, e];
      y = 0;
    } finally {
      f = t = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
}
function __exportStar(m, o) {
  for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
}
function __values(o) {
  var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
  if (m) return m.call(o);
  if (o && typeof o.length === "number") return {
    next: function() {
      if (o && i >= o.length) o = void 0;
      return { value: o && o[i++], done: !o };
    }
  };
  throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function __read(o, n) {
  var m = typeof Symbol === "function" && o[Symbol.iterator];
  if (!m) return o;
  var i = m.call(o), r, ar = [], e;
  try {
    while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
  } catch (error) {
    e = { error };
  } finally {
    try {
      if (r && !r.done && (m = i["return"])) m.call(i);
    } finally {
      if (e) throw e.error;
    }
  }
  return ar;
}
function __spread() {
  for (var ar = [], i = 0; i < arguments.length; i++)
    ar = ar.concat(__read(arguments[i]));
  return ar;
}
function __spreadArrays() {
  for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
  for (var r = Array(s), k = 0, i = 0; i < il; i++)
    for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
      r[k] = a[j];
  return r;
}
function __spreadArray(to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i);
      ar[i] = from[i];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
}
function __await(v) {
  return this instanceof __await ? (this.v = v, this) : new __await(v);
}
function __asyncGenerator(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function awaitReturn(f) {
    return function(v) {
      return Promise.resolve(v).then(f, reject);
    };
  }
  function verb(n, f) {
    if (g[n]) {
      i[n] = function(v) {
        return new Promise(function(a, b) {
          q.push([n, v, a, b]) > 1 || resume(n, v);
        });
      };
      if (f) i[n] = f(i[n]);
    }
  }
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  function step(r) {
    r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f, v) {
    if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
  }
}
function __asyncDelegator(o) {
  var i, p;
  return i = {}, verb("next"), verb("throw", function(e) {
    throw e;
  }), verb("return"), i[Symbol.iterator] = function() {
    return this;
  }, i;
  function verb(n, f) {
    i[n] = o[n] ? function(v) {
      return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v;
    } : f;
  }
}
function __asyncValues(o) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var m = o[Symbol.asyncIterator], i;
  return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i);
  function verb(n) {
    i[n] = o[n] && function(v) {
      return new Promise(function(resolve, reject) {
        v = o[n](v), settle(resolve, reject, v.done, v.value);
      });
    };
  }
  function settle(resolve, reject, d, v) {
    Promise.resolve(v).then(function(v2) {
      resolve({ value: v2, done: d });
    }, reject);
  }
}
function __makeTemplateObject(cooked, raw) {
  if (Object.defineProperty) {
    Object.defineProperty(cooked, "raw", { value: raw });
  } else {
    cooked.raw = raw;
  }
  return cooked;
}
function __importStar(mod) {
  if (mod && mod.__esModule) return mod;
  var result = {};
  if (mod != null) {
    for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
  }
  __setModuleDefault(result, mod);
  return result;
}
function __importDefault(mod) {
  return mod && mod.__esModule ? mod : { default: mod };
}
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
function __classPrivateFieldIn(state, receiver) {
  if (receiver === null || typeof receiver !== "object" && typeof receiver !== "function") throw new TypeError("Cannot use 'in' operator on non-object");
  return typeof state === "function" ? receiver === state : state.has(receiver);
}
function __addDisposableResource(env, value, async) {
  if (value !== null && value !== void 0) {
    if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
    var dispose, inner;
    if (async) {
      if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
      dispose = value[Symbol.asyncDispose];
    }
    if (dispose === void 0) {
      if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
      dispose = value[Symbol.dispose];
      if (async) inner = dispose;
    }
    if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
    if (inner) dispose = function() {
      try {
        inner.call(this);
      } catch (e) {
        return Promise.reject(e);
      }
    };
    env.stack.push({ value, dispose, async });
  } else if (async) {
    env.stack.push({ async: true });
  }
  return value;
}
function __disposeResources(env) {
  function fail(e) {
    env.error = env.hasError ? new _SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
    env.hasError = true;
  }
  var r, s = 0;
  function next() {
    while (r = env.stack.pop()) {
      try {
        if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
        if (r.dispose) {
          var result = r.dispose.call(r.value);
          if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
            fail(e);
            return next();
          });
        } else s |= 1;
      } catch (e) {
        fail(e);
      }
    }
    if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
    if (env.hasError) throw env.error;
  }
  return next();
}
function __rewriteRelativeImportExtension(path, preserveJsx) {
  if (typeof path === "string" && /^\.\.?\//.test(path)) {
    return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function(m, tsx, d, ext, cm) {
      return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : d + ext + "." + cm.toLowerCase() + "js";
    });
  }
  return path;
}
var extendStatics, __assign, __createBinding, __setModuleDefault, ownKeys, _SuppressedError, tslib_es6_default;
var init_tslib_es6 = __esm({
  "node_modules/tslib/tslib.es6.mjs"() {
    extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
        d2.__proto__ = b2;
      } || function(d2, b2) {
        for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
      };
      return extendStatics(d, b);
    };
    __assign = function() {
      __assign = Object.assign || function __assign2(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
      return __assign.apply(this, arguments);
    };
    __createBinding = Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    };
    __setModuleDefault = Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    };
    ownKeys = function(o) {
      ownKeys = Object.getOwnPropertyNames || function(o2) {
        var ar = [];
        for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
        return ar;
      };
      return ownKeys(o);
    };
    _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
      var e = new Error(message);
      return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };
    tslib_es6_default = {
      __extends,
      __assign,
      __rest,
      __decorate,
      __param,
      __esDecorate,
      __runInitializers,
      __propKey,
      __setFunctionName,
      __metadata,
      __awaiter,
      __generator,
      __createBinding,
      __exportStar,
      __values,
      __read,
      __spread,
      __spreadArrays,
      __spreadArray,
      __await,
      __asyncGenerator,
      __asyncDelegator,
      __asyncValues,
      __makeTemplateObject,
      __importStar,
      __importDefault,
      __classPrivateFieldGet,
      __classPrivateFieldSet,
      __classPrivateFieldIn,
      __addDisposableResource,
      __disposeResources,
      __rewriteRelativeImportExtension
    };
  }
});

// node_modules/@elgato-stream-deck/core/dist/id.js
var require_id = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/id.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MODEL_NAMES = exports.DeviceModelId = void 0;
    var DeviceModelId;
    (function(DeviceModelId2) {
      DeviceModelId2["ORIGINAL"] = "original";
      DeviceModelId2["ORIGINALV2"] = "originalv2";
      DeviceModelId2["ORIGINALMK2"] = "original-mk2";
      DeviceModelId2["ORIGINALMK2SCISSOR"] = "original-mk2-scissor";
      DeviceModelId2["MINI"] = "mini";
      DeviceModelId2["XL"] = "xl";
      DeviceModelId2["PEDAL"] = "pedal";
      DeviceModelId2["PLUS"] = "plus";
      DeviceModelId2["NEO"] = "neo";
      DeviceModelId2["STUDIO"] = "studio";
      DeviceModelId2["MODULE6"] = "6-module";
      DeviceModelId2["MODULE15"] = "15-module";
      DeviceModelId2["MODULE32"] = "32-module";
      DeviceModelId2["MODULE15SCISSOR"] = "15-module-scissor";
      DeviceModelId2["NETWORK_DOCK"] = "network-dock";
      DeviceModelId2["GALLEON_K100"] = "galleon-k100";
      DeviceModelId2["PLUS_XL"] = "plus-xl";
    })(DeviceModelId || (exports.DeviceModelId = DeviceModelId = {}));
    exports.MODEL_NAMES = {
      [DeviceModelId.ORIGINAL]: "Stream Deck",
      [DeviceModelId.MINI]: "Stream Deck Mini",
      [DeviceModelId.XL]: "Stream Deck XL",
      [DeviceModelId.ORIGINALV2]: "Stream Deck",
      [DeviceModelId.ORIGINALMK2]: "Stream Deck MK.2",
      [DeviceModelId.ORIGINALMK2SCISSOR]: "Stream Deck MK.2 (Scissor)",
      [DeviceModelId.PLUS]: "Stream Deck +",
      [DeviceModelId.PEDAL]: "Stream Deck Pedal",
      [DeviceModelId.NEO]: "Stream Deck Neo",
      [DeviceModelId.STUDIO]: "Stream Deck Studio",
      [DeviceModelId.MODULE6]: "Stream Deck 6 Module",
      [DeviceModelId.MODULE15]: "Stream Deck 15 Module",
      [DeviceModelId.MODULE32]: "Stream Deck 32 Module",
      [DeviceModelId.MODULE15SCISSOR]: "Stream Deck 15 Module (Scissor)",
      [DeviceModelId.NETWORK_DOCK]: "Stream Deck Network Dock",
      [DeviceModelId.GALLEON_K100]: "Galleon K100 SD",
      [DeviceModelId.PLUS_XL]: "Stream Deck + XL"
    };
  }
});

// node_modules/eventemitter3/index.js
var require_eventemitter3 = __commonJS({
  "node_modules/eventemitter3/index.js"(exports, module) {
    "use strict";
    var has = Object.prototype.hasOwnProperty;
    var prefix = "~";
    function Events() {
    }
    if (Object.create) {
      Events.prototype = /* @__PURE__ */ Object.create(null);
      if (!new Events().__proto__) prefix = false;
    }
    function EE(fn, context, once) {
      this.fn = fn;
      this.context = context;
      this.once = once || false;
    }
    function addListener(emitter, event, fn, context, once) {
      if (typeof fn !== "function") {
        throw new TypeError("The listener must be a function");
      }
      var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
      if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
      else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
      else emitter._events[evt] = [emitter._events[evt], listener];
      return emitter;
    }
    function clearEvent(emitter, evt) {
      if (--emitter._eventsCount === 0) emitter._events = new Events();
      else delete emitter._events[evt];
    }
    function EventEmitter() {
      this._events = new Events();
      this._eventsCount = 0;
    }
    EventEmitter.prototype.eventNames = function eventNames() {
      var names = [], events, name;
      if (this._eventsCount === 0) return names;
      for (name in events = this._events) {
        if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
      }
      if (Object.getOwnPropertySymbols) {
        return names.concat(Object.getOwnPropertySymbols(events));
      }
      return names;
    };
    EventEmitter.prototype.listeners = function listeners(event) {
      var evt = prefix ? prefix + event : event, handlers = this._events[evt];
      if (!handlers) return [];
      if (handlers.fn) return [handlers.fn];
      for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
        ee[i] = handlers[i].fn;
      }
      return ee;
    };
    EventEmitter.prototype.listenerCount = function listenerCount(event) {
      var evt = prefix ? prefix + event : event, listeners = this._events[evt];
      if (!listeners) return 0;
      if (listeners.fn) return 1;
      return listeners.length;
    };
    EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return false;
      var listeners = this._events[evt], len = arguments.length, args, i;
      if (listeners.fn) {
        if (listeners.once) this.removeListener(event, listeners.fn, void 0, true);
        switch (len) {
          case 1:
            return listeners.fn.call(listeners.context), true;
          case 2:
            return listeners.fn.call(listeners.context, a1), true;
          case 3:
            return listeners.fn.call(listeners.context, a1, a2), true;
          case 4:
            return listeners.fn.call(listeners.context, a1, a2, a3), true;
          case 5:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
          case 6:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
        }
        for (i = 1, args = new Array(len - 1); i < len; i++) {
          args[i - 1] = arguments[i];
        }
        listeners.fn.apply(listeners.context, args);
      } else {
        var length = listeners.length, j;
        for (i = 0; i < length; i++) {
          if (listeners[i].once) this.removeListener(event, listeners[i].fn, void 0, true);
          switch (len) {
            case 1:
              listeners[i].fn.call(listeners[i].context);
              break;
            case 2:
              listeners[i].fn.call(listeners[i].context, a1);
              break;
            case 3:
              listeners[i].fn.call(listeners[i].context, a1, a2);
              break;
            case 4:
              listeners[i].fn.call(listeners[i].context, a1, a2, a3);
              break;
            default:
              if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) {
                args[j - 1] = arguments[j];
              }
              listeners[i].fn.apply(listeners[i].context, args);
          }
        }
      }
      return true;
    };
    EventEmitter.prototype.on = function on(event, fn, context) {
      return addListener(this, event, fn, context, false);
    };
    EventEmitter.prototype.once = function once(event, fn, context) {
      return addListener(this, event, fn, context, true);
    };
    EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return this;
      if (!fn) {
        clearEvent(this, evt);
        return this;
      }
      var listeners = this._events[evt];
      if (listeners.fn) {
        if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
          clearEvent(this, evt);
        }
      } else {
        for (var i = 0, events = [], length = listeners.length; i < length; i++) {
          if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) {
            events.push(listeners[i]);
          }
        }
        if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
        else clearEvent(this, evt);
      }
      return this;
    };
    EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
      var evt;
      if (event) {
        evt = prefix ? prefix + event : event;
        if (this._events[evt]) clearEvent(this, evt);
      } else {
        this._events = new Events();
        this._eventsCount = 0;
      }
      return this;
    };
    EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
    EventEmitter.prototype.addListener = EventEmitter.prototype.on;
    EventEmitter.prefixed = prefix;
    EventEmitter.EventEmitter = EventEmitter;
    if ("undefined" !== typeof module) {
      module.exports = EventEmitter;
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/preparedBuffer.js
var require_preparedBuffer = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/preparedBuffer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.wrapBufferToPreparedBuffer = wrapBufferToPreparedBuffer;
    exports.unwrapPreparedBufferToBuffer = unwrapPreparedBufferToBuffer;
    function wrapBufferToPreparedBuffer(modelId, type, buffers, jsonSafe) {
      let encodedBuffers = buffers;
      if (jsonSafe) {
        if (typeof Buffer !== "undefined") {
          encodedBuffers = buffers.map((b) => Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString("base64"));
        } else {
          encodedBuffers = buffers.map((b) => btoa(String.fromCharCode(...b)));
        }
      }
      return {
        if_you_change_this_you_will_break_everything: "This is a encoded form of the buffer, exactly as the Stream Deck expects it. Do not touch this object, or you can crash your stream deck",
        modelId,
        type,
        do_not_touch: encodedBuffers
      };
    }
    function unwrapPreparedBufferToBuffer(modelId, prepared) {
      const preparedInternal = prepared;
      if (preparedInternal.modelId !== modelId)
        throw new Error("Prepared buffer is for a different model!");
      return preparedInternal.do_not_touch.map((b) => {
        if (typeof b === "string") {
          if (typeof Buffer !== "undefined") {
            return Buffer.from(b, "base64");
          } else {
            return new Uint8Array(atob(b).split("").map((char) => char.charCodeAt(0)));
          }
        } else if (b instanceof Uint8Array) {
          return b;
        } else {
          throw new Error("Prepared buffer is not a string or Uint8Array!");
        }
      });
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/base.js
var require_base = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/base.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeckBase = void 0;
    var eventemitter3_1 = require_eventemitter3();
    var index_js_1 = require_dist();
    var preparedBuffer_js_1 = require_preparedBuffer();
    var StreamDeckBase = class extends eventemitter3_1.EventEmitter {
      get CONTROLS() {
        return this.deviceProperties.CONTROLS;
      }
      // get KEY_SPACING_HORIZONTAL(): number {
      // 	return this.deviceProperties.KEY_SPACING_HORIZONTAL
      // }
      // get KEY_SPACING_VERTICAL(): number {
      // 	return this.deviceProperties.KEY_SPACING_VERTICAL
      // }
      get MODEL() {
        return this.deviceProperties.MODEL;
      }
      get PRODUCT_NAME() {
        return this.deviceProperties.PRODUCT_NAME;
      }
      get HAS_NFC_READER() {
        return this.deviceProperties.HAS_NFC_READER;
      }
      device;
      deviceProperties;
      // readonly #options: Readonly<Required<OpenStreamDeckOptions>>
      #propertiesService;
      #buttonsLcdService;
      #lcdSegmentDisplayService;
      #inputService;
      #encoderLedService;
      constructor(device, _options, services) {
        super();
        this.device = device;
        this.deviceProperties = services.deviceProperties;
        this.#propertiesService = services.properties;
        this.#buttonsLcdService = services.buttonsLcd;
        this.#lcdSegmentDisplayService = services.lcdSegmentDisplay;
        this.#inputService = services.inputService;
        this.#encoderLedService = services.encoderLed;
        services.events?.listen((key, ...args) => this.emit(key, ...args));
        this.device.on("input", (data) => this.#inputService.handleInput(data));
        this.device.on("error", (err) => {
          this.emit("error", err);
        });
      }
      checkValidKeyIndex(keyIndex, feedbackType) {
        const buttonControl = this.deviceProperties.CONTROLS.find((control) => control.type === "button" && control.index === keyIndex);
        if (!buttonControl) {
          throw new TypeError(`Expected a valid keyIndex`);
        }
        if (feedbackType && buttonControl.feedbackType !== feedbackType) {
          throw new TypeError(`Expected a keyIndex with expected feedbackType`);
        }
      }
      calculateFillPanelDimensions(options) {
        return this.#buttonsLcdService.calculateFillPanelDimensions(options);
      }
      async close() {
        return this.device.close();
      }
      async getHidDeviceInfo() {
        return this.device.getDeviceInfo();
      }
      async setBrightness(percentage) {
        return this.#propertiesService.setBrightness(percentage);
      }
      async resetToLogo() {
        return this.#propertiesService.resetToLogo();
      }
      async getFirmwareVersion() {
        return this.#propertiesService.getFirmwareVersion();
      }
      async getAllFirmwareVersions() {
        return this.#propertiesService.getAllFirmwareVersions();
      }
      async getSerialNumber() {
        return this.#propertiesService.getSerialNumber();
      }
      async sendPreparedBuffer(buffer) {
        const packets = (0, preparedBuffer_js_1.unwrapPreparedBufferToBuffer)(this.deviceProperties.MODEL, buffer);
        await this.device.sendReports(packets);
      }
      async fillKeyColor(keyIndex, r, g, b) {
        this.checkValidKeyIndex(keyIndex, null);
        await this.#buttonsLcdService.fillKeyColor(keyIndex, r, g, b);
      }
      async fillKeyBuffer(keyIndex, imageBuffer, options) {
        this.checkValidKeyIndex(keyIndex, "lcd");
        await this.#buttonsLcdService.fillKeyBuffer(keyIndex, imageBuffer, options);
      }
      async prepareFillKeyBuffer(keyIndex, imageBuffer, options, jsonSafe) {
        return this.#buttonsLcdService.prepareFillKeyBuffer(keyIndex, imageBuffer, options, jsonSafe);
      }
      async fillPanelBuffer(imageBuffer, options) {
        await this.#buttonsLcdService.fillPanelBuffer(imageBuffer, options);
      }
      async prepareFillPanelBuffer(imageBuffer, options, jsonSafe) {
        return this.#buttonsLcdService.prepareFillPanelBuffer(imageBuffer, options, jsonSafe);
      }
      async clearKey(keyIndex) {
        this.checkValidKeyIndex(keyIndex, null);
        await this.#buttonsLcdService.clearKey(keyIndex);
      }
      async clearPanel() {
        const ps = [];
        ps.push(this.#buttonsLcdService.clearPanel());
        if (this.#lcdSegmentDisplayService)
          ps.push(this.#lcdSegmentDisplayService.clearAllLcdSegments());
        if (this.#encoderLedService)
          ps.push(this.#encoderLedService.clearAll());
        await Promise.all(ps);
      }
      async fillLcd(...args) {
        if (!this.#lcdSegmentDisplayService)
          throw new Error("Not supported for this model");
        return this.#lcdSegmentDisplayService.fillLcd(...args);
      }
      async fillLcdRegion(...args) {
        if (!this.#lcdSegmentDisplayService)
          throw new Error("Not supported for this model");
        return this.#lcdSegmentDisplayService.fillLcdRegion(...args);
      }
      async prepareFillLcdRegion(...args) {
        if (!this.#lcdSegmentDisplayService)
          throw new Error("Not supported for this model");
        return this.#lcdSegmentDisplayService.prepareFillLcdRegion(...args);
      }
      async clearLcdSegment(...args) {
        if (!this.#lcdSegmentDisplayService)
          throw new Error("Not supported for this model");
        return this.#lcdSegmentDisplayService.clearLcdSegment(...args);
      }
      async setEncoderColor(...args) {
        if (!this.#encoderLedService)
          throw new Error("Not supported for this model");
        return this.#encoderLedService.setEncoderColor(...args);
      }
      async setEncoderRingSingleColor(...args) {
        if (!this.#encoderLedService)
          throw new Error("Not supported for this model");
        return this.#encoderLedService.setEncoderRingSingleColor(...args);
      }
      async setEncoderRingColors(...args) {
        if (!this.#encoderLedService)
          throw new Error("Not supported for this model");
        return this.#encoderLedService.setEncoderRingColors(...args);
      }
      async getChildDeviceInfo() {
        const info = await this.device.getChildDeviceInfo();
        if (!info)
          return null;
        const model = index_js_1.DEVICE_MODELS.find((m) => m.productIds.includes(info.productId) && m.vendorId === info.vendorId);
        if (!model)
          return null;
        return {
          ...info,
          model: model.id
        };
      }
    };
    exports.StreamDeckBase = StreamDeckBase;
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/properties/gen1.js
var require_gen1 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/properties/gen1.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Gen1PropertiesService = void 0;
    var Gen1PropertiesService = class {
      #device;
      constructor(device) {
        this.#device = device;
      }
      async setBrightness(percentage) {
        if (percentage < 0 || percentage > 100) {
          throw new RangeError("Expected brightness percentage to be between 0 and 100");
        }
        const brightnessCommandBuffer = new Uint8Array([
          5,
          85,
          170,
          209,
          1,
          percentage,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]);
        await this.#device.sendFeatureReport(brightnessCommandBuffer);
      }
      async resetToLogo() {
        const resetCommandBuffer = new Uint8Array([
          11,
          99,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]);
        await this.#device.sendFeatureReport(resetCommandBuffer);
      }
      async getFirmwareVersion() {
        let val;
        try {
          val = await this.#device.getFeatureReport(4, 32);
        } catch (_e) {
          val = await this.#device.getFeatureReport(4, 17);
        }
        const end = val.indexOf(0, 5);
        return new TextDecoder("ascii").decode(val.subarray(5, end === -1 ? void 0 : end));
      }
      async getAllFirmwareVersions() {
        return {};
      }
      async getSerialNumber() {
        try {
          const val = await this.#device.getFeatureReport(3, 32);
          let end = 5;
          while (end < val.length && val[end] >= 32 && val[end] <= 126)
            end++;
          return new TextDecoder("ascii").decode(val.subarray(5, end));
        } catch (_e) {
          const val = await this.#device.getFeatureReport(3, 17);
          return new TextDecoder("ascii").decode(val.subarray(5, 17));
        }
      }
    };
    exports.Gen1PropertiesService = Gen1PropertiesService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/buttonsLcdDisplay/default.js
var require_default = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/buttonsLcdDisplay/default.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DefaultButtonsLcdService = void 0;
    var preparedBuffer_js_1 = require_preparedBuffer();
    var DefaultButtonsLcdService = class {
      #imageWriter;
      #imagePacker;
      #device;
      #deviceProperties;
      constructor(imageWriter, imagePacker, device, deviceProperties) {
        this.#imageWriter = imageWriter;
        this.#imagePacker = imagePacker;
        this.#device = device;
        this.#deviceProperties = deviceProperties;
      }
      getLcdButtonControls() {
        return this.#deviceProperties.CONTROLS.filter((control) => control.type === "button" && control.feedbackType === "lcd");
      }
      calculateLcdGridSpan(buttonsLcd) {
        if (buttonsLcd.length === 0)
          return null;
        const allRowValues = buttonsLcd.map((button) => button.row);
        const allColumnValues = buttonsLcd.map((button) => button.column);
        return {
          minRow: Math.min(...allRowValues),
          maxRow: Math.max(...allRowValues),
          minCol: Math.min(...allColumnValues),
          maxCol: Math.max(...allColumnValues)
        };
      }
      calculateDimensionsFromGridSpan(gridSpan, buttonPixelSize, withPadding) {
        if (withPadding) {
          throw new Error("Not implemented");
        } else {
          const rowCount = gridSpan.maxRow - gridSpan.minRow + 1;
          const columnCount = gridSpan.maxCol - gridSpan.minCol + 1;
          return {
            width: columnCount * buttonPixelSize.width,
            height: rowCount * buttonPixelSize.height
          };
        }
      }
      calculateFillPanelDimensions(options) {
        const buttonLcdControls = this.getLcdButtonControls();
        const gridSpan = this.calculateLcdGridSpan(buttonLcdControls);
        if (!gridSpan || buttonLcdControls.length === 0)
          return null;
        return this.calculateDimensionsFromGridSpan(gridSpan, buttonLcdControls[0].pixelSize, options?.withPadding);
      }
      async clearPanel() {
        const ps = [];
        if (this.#deviceProperties.FULLSCREEN_PANELS > 0) {
          for (let screenIndex = 0; screenIndex < this.#deviceProperties.FULLSCREEN_PANELS; screenIndex++) {
            ps.push(this.#device.sendFeatureReport(new Uint8Array([3, 5, screenIndex, 0, 0, 0])));
          }
        } else {
          for (const control of this.#deviceProperties.CONTROLS) {
            if (control.type !== "button")
              continue;
            switch (control.feedbackType) {
              case "rgb":
                ps.push(this.sendKeyRgb(control.hidIndex, 0, 0, 0));
                break;
              case "lcd":
                if (this.#deviceProperties.SUPPORTS_RGB_KEY_FILL) {
                  ps.push(this.sendKeyRgb(control.hidIndex, 0, 0, 0));
                } else {
                  const pixels = new Uint8Array(control.pixelSize.width * control.pixelSize.height * 3);
                  ps.push(this.fillImageRangeControl(control, pixels, {
                    format: "rgb",
                    offset: 0,
                    stride: control.pixelSize.width * 3
                  }));
                }
                break;
              case "none":
                break;
            }
          }
        }
        await Promise.all(ps);
      }
      async clearKey(keyIndex) {
        const control = this.#deviceProperties.CONTROLS.find((control2) => control2.type === "button" && control2.index === keyIndex);
        if (!control || control.feedbackType === "none")
          throw new TypeError(`Expected a valid keyIndex`);
        if (this.#deviceProperties.SUPPORTS_RGB_KEY_FILL || control.feedbackType === "rgb") {
          await this.sendKeyRgb(control.hidIndex, 0, 0, 0);
        } else {
          const pixels = new Uint8Array(control.pixelSize.width * control.pixelSize.height * 3);
          await this.fillImageRangeControl(control, pixels, {
            format: "rgb",
            offset: 0,
            stride: control.pixelSize.width * 3
          });
        }
      }
      async fillKeyColor(keyIndex, r, g, b) {
        this.checkRGBValue(r);
        this.checkRGBValue(g);
        this.checkRGBValue(b);
        const control = this.#deviceProperties.CONTROLS.find((control2) => control2.type === "button" && control2.index === keyIndex);
        if (!control || control.feedbackType === "none")
          throw new TypeError(`Expected a valid keyIndex`);
        if (this.#deviceProperties.SUPPORTS_RGB_KEY_FILL || control.feedbackType === "rgb") {
          await this.sendKeyRgb(control.hidIndex, r, g, b);
        } else {
          const pixelCount = control.pixelSize.width * control.pixelSize.height;
          const pixels = new Uint8Array(pixelCount * 4);
          const view = new DataView(pixels.buffer, pixels.byteOffset, pixels.byteLength);
          view.setUint8(0, r);
          view.setUint8(1, g);
          view.setUint8(2, b);
          view.setUint8(3, 255);
          const sample = view.getUint32(0);
          for (let i = 1; i < pixelCount; i++) {
            view.setUint32(i * 4, sample);
          }
          await this.fillImageRangeControl(control, pixels, {
            format: "rgba",
            offset: 0,
            stride: control.pixelSize.width * 4
          });
        }
      }
      async fillKeyBuffer(keyIndex, imageBuffer, options) {
        const packets = await this.prepareFillKeyBufferInner(keyIndex, imageBuffer, options);
        await this.#device.sendReports(packets);
      }
      async prepareFillKeyBufferInner(keyIndex, imageBuffer, options) {
        const sourceFormat = options?.format ?? "rgb";
        this.checkSourceFormat(sourceFormat);
        const control = this.#deviceProperties.CONTROLS.find((control2) => control2.type === "button" && control2.index === keyIndex);
        if (!control || control.feedbackType === "none")
          throw new TypeError(`Expected a valid keyIndex`);
        if (control.feedbackType !== "lcd")
          throw new TypeError(`keyIndex ${control.index} does not support lcd feedback`);
        const imageSize = control.pixelSize.width * control.pixelSize.height * sourceFormat.length;
        if (imageBuffer.length !== imageSize) {
          throw new RangeError(`Expected image buffer of length ${imageSize}, got length ${imageBuffer.length}`);
        }
        return this.prepareFillImageRangeControl(control, imageBuffer, {
          format: sourceFormat,
          offset: 0,
          stride: control.pixelSize.width * sourceFormat.length
        });
      }
      async prepareFillKeyBuffer(keyIndex, imageBuffer, options, jsonSafe) {
        const packets = await this.prepareFillKeyBufferInner(keyIndex, imageBuffer, options);
        return (0, preparedBuffer_js_1.wrapBufferToPreparedBuffer)(this.#deviceProperties.MODEL, "fill-key", packets, jsonSafe ?? false);
      }
      async fillPanelBuffer(imageBuffer, options) {
        const packets = await this.prepareFillPanelBufferInner(imageBuffer, options);
        await this.#device.sendReports(packets);
      }
      async prepareFillPanelBufferInner(imageBuffer, options) {
        const sourceFormat = options?.format ?? "rgb";
        this.checkSourceFormat(sourceFormat);
        const buttonLcdControls = this.getLcdButtonControls();
        const panelGridSpan = this.calculateLcdGridSpan(buttonLcdControls);
        if (!panelGridSpan || buttonLcdControls.length === 0) {
          throw new Error(`Panel does not support being filled`);
        }
        const panelDimensions = this.calculateDimensionsFromGridSpan(panelGridSpan, buttonLcdControls[0].pixelSize, options?.withPadding);
        const expectedByteCount = sourceFormat.length * panelDimensions.width * panelDimensions.height;
        if (imageBuffer.length !== expectedByteCount) {
          throw new RangeError(`Expected image buffer of length ${expectedByteCount}, got length ${imageBuffer.length}`);
        }
        const stride = panelDimensions.width * sourceFormat.length;
        const ps = [];
        for (const control of buttonLcdControls) {
          const controlRow = control.row - panelGridSpan.minRow;
          const controlCol = control.column - panelGridSpan.minCol;
          const iconSize = control.pixelSize.width * sourceFormat.length;
          const rowOffset = stride * controlRow * control.pixelSize.height;
          const colOffset = controlCol * iconSize;
          ps.push(this.prepareFillImageRangeControl(control, imageBuffer, {
            format: sourceFormat,
            offset: rowOffset + colOffset,
            stride
          }));
        }
        const packets = await Promise.all(ps);
        return packets.flat();
      }
      async prepareFillPanelBuffer(imageBuffer, options, jsonSafe) {
        const packets = await this.prepareFillPanelBufferInner(imageBuffer, options);
        return (0, preparedBuffer_js_1.wrapBufferToPreparedBuffer)(this.#deviceProperties.MODEL, "fill-panel", packets, jsonSafe ?? false);
      }
      async sendKeyRgb(keyIndex, red, green, blue) {
        await this.#device.sendFeatureReport(new Uint8Array([3, 6, keyIndex, red, green, blue]));
      }
      async fillImageRangeControl(buttonControl, imageBuffer, sourceOptions) {
        const packets = await this.prepareFillImageRangeControl(buttonControl, imageBuffer, sourceOptions);
        await this.#device.sendReports(packets);
      }
      async prepareFillImageRangeControl(buttonControl, imageBuffer, sourceOptions) {
        if (buttonControl.feedbackType !== "lcd")
          throw new TypeError(`keyIndex ${buttonControl.index} does not support lcd feedback`);
        const byteBuffer = await this.#imagePacker.convertPixelBuffer(imageBuffer, sourceOptions, buttonControl.pixelSize);
        return this.#imageWriter.generateFillImageWrites({ keyIndex: buttonControl.hidIndex }, byteBuffer);
      }
      checkRGBValue(value) {
        if (value < 0 || value > 255) {
          throw new TypeError("Expected a valid color RGB value 0 - 255");
        }
      }
      checkSourceFormat(format) {
        switch (format) {
          case "rgb":
          case "rgba":
          case "bgr":
          case "bgra":
            break;
          default: {
            const fmt = format;
            throw new TypeError(`Expected a known color format not "${fmt}"`);
          }
        }
      }
    };
    exports.DefaultButtonsLcdService = DefaultButtonsLcdService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/util.js
var require_util = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BMP_HEADER_LENGTH = void 0;
    exports.transformImageBuffer = transformImageBuffer;
    exports.writeBMPHeader = writeBMPHeader;
    exports.uint8ArrayToDataView = uint8ArrayToDataView;
    function transformImageBuffer(imageBuffer, sourceOptions, targetOptions, destPadding, imageWidth, imageHeight) {
      const imageBufferView = uint8ArrayToDataView(imageBuffer);
      const targetWidth = targetOptions.rotate ? imageHeight : imageWidth;
      const targetHeight = targetOptions.rotate ? imageWidth : imageHeight;
      const byteBuffer = new Uint8Array(destPadding + targetWidth * targetHeight * targetOptions.colorMode.length);
      const byteBufferView = uint8ArrayToDataView(byteBuffer);
      const flipColours = sourceOptions.format.substring(0, 3) !== targetOptions.colorMode.substring(0, 3);
      for (let y = 0; y < targetHeight; y++) {
        const rowOffset = destPadding + targetWidth * targetOptions.colorMode.length * y;
        for (let x = 0; x < targetWidth; x++) {
          let x2 = targetOptions.xFlip ? targetWidth - x - 1 : x;
          let y2 = targetOptions.yFlip ? targetHeight - y - 1 : y;
          if (targetOptions.rotate) {
            const tmpX = x2;
            x2 = y2;
            y2 = tmpX;
          }
          const srcOffset = y2 * sourceOptions.stride + sourceOptions.offset + x2 * sourceOptions.format.length;
          const red = imageBufferView.getUint8(srcOffset);
          const green = imageBufferView.getUint8(srcOffset + 1);
          const blue = imageBufferView.getUint8(srcOffset + 2);
          const targetOffset = rowOffset + x * targetOptions.colorMode.length;
          if (flipColours) {
            byteBufferView.setUint8(targetOffset, blue);
            byteBufferView.setUint8(targetOffset + 1, green);
            byteBufferView.setUint8(targetOffset + 2, red);
          } else {
            byteBufferView.setUint8(targetOffset, red);
            byteBufferView.setUint8(targetOffset + 1, green);
            byteBufferView.setUint8(targetOffset + 2, blue);
          }
          if (targetOptions.colorMode.length === 4) {
            byteBufferView.setUint8(targetOffset + 3, 255);
          }
        }
      }
      return byteBuffer;
    }
    exports.BMP_HEADER_LENGTH = 54;
    function writeBMPHeader(buf, imageWidth, imageHeight, imageBytes, imagePPM) {
      const bufView = uint8ArrayToDataView(buf);
      bufView.setUint8(0, 66);
      bufView.setUint8(1, 77);
      bufView.setUint32(2, imageBytes + 54, true);
      bufView.setInt16(6, 0, true);
      bufView.setInt16(8, 0, true);
      bufView.setUint32(10, 54, true);
      bufView.setUint32(14, 40, true);
      bufView.setInt32(18, imageWidth, true);
      bufView.setInt32(22, imageHeight, true);
      bufView.setInt16(26, 1, true);
      bufView.setInt16(28, 24, true);
      bufView.setInt32(30, 0, true);
      bufView.setInt32(34, imageBytes, true);
      bufView.setInt32(38, imagePPM, true);
      bufView.setInt32(42, imagePPM, true);
      bufView.setInt32(46, 0, true);
      bufView.setInt32(50, 0, true);
    }
    function uint8ArrayToDataView(buffer) {
      return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/imagePacker/bitmap.js
var require_bitmap = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/imagePacker/bitmap.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BitmapButtonLcdImagePacker = void 0;
    var util_js_1 = require_util();
    var BitmapButtonLcdImagePacker = class {
      #targetOptions;
      #bmpImagePPM;
      constructor(targetOptions, bmpImagePPM) {
        this.#targetOptions = targetOptions;
        this.#bmpImagePPM = bmpImagePPM;
      }
      async convertPixelBuffer(sourceBuffer, sourceOptions, targetSize) {
        const byteBuffer = (0, util_js_1.transformImageBuffer)(sourceBuffer, sourceOptions, this.#targetOptions, util_js_1.BMP_HEADER_LENGTH, targetSize.width, targetSize.height);
        (0, util_js_1.writeBMPHeader)(byteBuffer, targetSize.width, targetSize.height, byteBuffer.length - util_js_1.BMP_HEADER_LENGTH, this.#bmpImagePPM);
        return byteBuffer;
      }
    };
    exports.BitmapButtonLcdImagePacker = BitmapButtonLcdImagePacker;
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/callback-hook.js
var require_callback_hook = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/callback-hook.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CallbackHook = void 0;
    var CallbackHook = class {
      #listener = null;
      emit(key, ...args) {
        if (!this.#listener)
          throw new Error("No listener setup");
        this.#listener(key, ...args);
      }
      listen(fn) {
        this.#listener = fn;
      }
    };
    exports.CallbackHook = CallbackHook;
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/input/gen1.js
var require_gen12 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/input/gen1.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ButtonOnlyInputService = void 0;
    var ButtonOnlyInputService = class {
      deviceProperties;
      #keyState;
      #eventSource;
      constructor(deviceProperties, eventSource) {
        this.deviceProperties = deviceProperties;
        this.#eventSource = eventSource;
        const maxButtonIndex = this.deviceProperties.CONTROLS.filter((control) => control.type === "button").map((control) => control.index);
        this.#keyState = new Array(Math.max(-1, ...maxButtonIndex) + 1).fill(false);
      }
      handleInput(data) {
        const dataOffset = this.deviceProperties.KEY_DATA_OFFSET || 0;
        for (const control of this.deviceProperties.CONTROLS) {
          if (control.type !== "button")
            continue;
          const keyPressed = Boolean(data[dataOffset + control.hidIndex]);
          const stateChanged = keyPressed !== this.#keyState[control.index];
          if (stateChanged) {
            this.#keyState[control.index] = keyPressed;
            if (keyPressed) {
              this.#eventSource.emit("down", control);
            } else {
              this.#eventSource.emit("up", control);
            }
          }
        }
      }
    };
    exports.ButtonOnlyInputService = ButtonOnlyInputService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/generic-gen1.js
var require_generic_gen1 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/generic-gen1.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeckGen1Factory = StreamDeckGen1Factory;
    var base_js_1 = require_base();
    var gen1_js_1 = require_gen1();
    var default_js_1 = require_default();
    var bitmap_js_1 = require_bitmap();
    var callback_hook_js_1 = require_callback_hook();
    var gen1_js_2 = require_gen12();
    function extendDevicePropertiesForGen1(rawProps) {
      return {
        ...rawProps,
        KEY_DATA_OFFSET: 0,
        HAS_NFC_READER: false,
        SUPPORTS_CHILD_DEVICES: false
      };
    }
    function StreamDeckGen1Factory(device, options, properties, imageWriter, targetOptions, bmpImagePPM) {
      const fullProperties = extendDevicePropertiesForGen1(properties);
      const events = new callback_hook_js_1.CallbackHook();
      return new base_js_1.StreamDeckBase(device, options, {
        deviceProperties: fullProperties,
        events,
        properties: new gen1_js_1.Gen1PropertiesService(device),
        buttonsLcd: new default_js_1.DefaultButtonsLcdService(imageWriter, new bitmap_js_1.BitmapButtonLcdImagePacker(targetOptions, bmpImagePPM), device, fullProperties),
        lcdSegmentDisplay: null,
        inputService: new gen1_js_2.ButtonOnlyInputService(fullProperties, events),
        encoderLed: null
      });
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/imageWriter/headerGenerator.js
var require_headerGenerator = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/imageWriter/headerGenerator.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamdeckNeoLcdImageHeaderGenerator = exports.StreamdeckDefaultLcdImageHeaderGenerator = exports.StreamdeckGen2ImageHeaderGenerator = exports.StreamdeckGen1ImageHeaderGenerator = void 0;
    var util_js_1 = require_util();
    var StreamdeckGen1ImageHeaderGenerator = class {
      getFillImageCommandHeaderLength() {
        return 16;
      }
      writeFillImageCommandHeader(buffer, props, partIndex, isLast, _bodyLength) {
        const bufferView = (0, util_js_1.uint8ArrayToDataView)(buffer);
        bufferView.setUint8(0, 2);
        bufferView.setUint8(1, 1);
        bufferView.setUint8(2, partIndex);
        bufferView.setUint8(4, isLast ? 1 : 0);
        bufferView.setUint8(5, props.keyIndex + 1);
      }
    };
    exports.StreamdeckGen1ImageHeaderGenerator = StreamdeckGen1ImageHeaderGenerator;
    var StreamdeckGen2ImageHeaderGenerator = class {
      getFillImageCommandHeaderLength() {
        return 8;
      }
      writeFillImageCommandHeader(buffer, props, partIndex, isLast, bodyLength) {
        const bufferView = (0, util_js_1.uint8ArrayToDataView)(buffer);
        bufferView.setUint8(0, 2);
        bufferView.setUint8(1, 7);
        bufferView.setUint8(2, props.keyIndex);
        bufferView.setUint8(3, isLast ? 1 : 0);
        bufferView.setUint16(4, bodyLength, true);
        bufferView.setUint16(6, partIndex, true);
      }
    };
    exports.StreamdeckGen2ImageHeaderGenerator = StreamdeckGen2ImageHeaderGenerator;
    var StreamdeckDefaultLcdImageHeaderGenerator = class {
      getFillImageCommandHeaderLength() {
        return 16;
      }
      writeFillImageCommandHeader(buffer, props, partIndex, isLast, bodyLength) {
        const bufferView = (0, util_js_1.uint8ArrayToDataView)(buffer);
        bufferView.setUint8(0, 2);
        bufferView.setUint8(1, 12);
        bufferView.setUint16(2, props.x, true);
        bufferView.setUint16(4, props.y, true);
        bufferView.setUint16(6, props.width, true);
        bufferView.setUint16(8, props.height, true);
        bufferView.setUint8(10, isLast ? 1 : 0);
        bufferView.setUint16(11, partIndex, true);
        bufferView.setUint16(13, bodyLength, true);
      }
    };
    exports.StreamdeckDefaultLcdImageHeaderGenerator = StreamdeckDefaultLcdImageHeaderGenerator;
    var StreamdeckNeoLcdImageHeaderGenerator = class {
      getFillImageCommandHeaderLength() {
        return 8;
      }
      writeFillImageCommandHeader(buffer, _props, partIndex, isLast, bodyLength) {
        const bufferView = (0, util_js_1.uint8ArrayToDataView)(buffer);
        bufferView.setUint8(0, 2);
        bufferView.setUint8(1, 11);
        bufferView.setUint8(2, 0);
        bufferView.setUint8(3, isLast ? 1 : 0);
        bufferView.setUint16(4, bodyLength, true);
        bufferView.setUint16(6, partIndex, true);
      }
    };
    exports.StreamdeckNeoLcdImageHeaderGenerator = StreamdeckNeoLcdImageHeaderGenerator;
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/imageWriter/imageWriter.js
var require_imageWriter = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/imageWriter/imageWriter.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamdeckDefaultImageWriter = exports.StreamdeckOriginalImageWriter = void 0;
    var headerGenerator_js_1 = require_headerGenerator();
    var StreamdeckOriginalImageWriter = class {
      headerGenerator = new headerGenerator_js_1.StreamdeckGen1ImageHeaderGenerator();
      generateFillImageWrites(props, byteBuffer) {
        const MAX_PACKET_SIZE = 8191;
        const PACKET_HEADER_LENGTH = this.headerGenerator.getFillImageCommandHeaderLength();
        const packet1Bytes = byteBuffer.length / 2;
        const packet1 = new Uint8Array(MAX_PACKET_SIZE);
        this.headerGenerator.writeFillImageCommandHeader(packet1, props, 1, false, packet1Bytes);
        packet1.set(byteBuffer.subarray(0, packet1Bytes), PACKET_HEADER_LENGTH);
        const packet2 = new Uint8Array(MAX_PACKET_SIZE);
        this.headerGenerator.writeFillImageCommandHeader(packet2, props, 2, true, packet1Bytes);
        packet2.set(byteBuffer.subarray(packet1Bytes), PACKET_HEADER_LENGTH);
        return [packet1, packet2];
      }
    };
    exports.StreamdeckOriginalImageWriter = StreamdeckOriginalImageWriter;
    var StreamdeckDefaultImageWriter = class {
      headerGenerator;
      constructor(headerGenerator) {
        this.headerGenerator = headerGenerator;
      }
      generateFillImageWrites(props, byteBuffer) {
        const MAX_PACKET_SIZE = 1024;
        const PACKET_HEADER_LENGTH = this.headerGenerator.getFillImageCommandHeaderLength();
        const MAX_PAYLOAD_SIZE = MAX_PACKET_SIZE - PACKET_HEADER_LENGTH;
        const result = [];
        let remainingBytes = byteBuffer.length;
        for (let part = 0; remainingBytes > 0; part++) {
          const packet = new Uint8Array(MAX_PACKET_SIZE);
          const byteCount = Math.min(remainingBytes, MAX_PAYLOAD_SIZE);
          this.headerGenerator.writeFillImageCommandHeader(packet, props, part, remainingBytes <= MAX_PAYLOAD_SIZE, byteCount);
          const byteOffset = byteBuffer.length - remainingBytes;
          remainingBytes -= byteCount;
          packet.set(byteBuffer.subarray(byteOffset, byteOffset + byteCount), PACKET_HEADER_LENGTH);
          result.push(packet);
        }
        return result;
      }
    };
    exports.StreamdeckDefaultImageWriter = StreamdeckDefaultImageWriter;
  }
});

// node_modules/@elgato-stream-deck/core/dist/controlsGenerator.js
var require_controlsGenerator = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/controlsGenerator.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.generateButtonsGrid = generateButtonsGrid;
    exports.freezeDefinitions = freezeDefinitions;
    function generateButtonsGrid(width, height, pixelSize, rtl = false, columnOffset = 0, rowOffset = 0) {
      const controls = [];
      for (let row = 0; row < height; row++) {
        for (let column = 0; column < width; column++) {
          const index = row * width + column;
          const hidIndex = rtl ? flipKeyIndex(width, index) : index;
          controls.push({
            type: "button",
            row: row + rowOffset,
            column: column + columnOffset,
            index,
            hidIndex,
            feedbackType: "lcd",
            pixelSize
          });
        }
      }
      return controls;
    }
    function flipKeyIndex(columns, keyIndex) {
      const half = (columns - 1) / 2;
      const diff = (keyIndex % columns - half) * -half;
      return keyIndex + diff;
    }
    function freezeDefinitions(controls) {
      return Object.freeze(controls.map((control) => Object.freeze(control)));
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/original.js
var require_original = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/original.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeckOriginalFactory = StreamDeckOriginalFactory;
    var generic_gen1_js_1 = require_generic_gen1();
    var id_js_1 = require_id();
    var imageWriter_js_1 = require_imageWriter();
    var controlsGenerator_js_1 = require_controlsGenerator();
    var originalProperties = {
      MODEL: id_js_1.DeviceModelId.ORIGINAL,
      PRODUCT_NAME: id_js_1.MODEL_NAMES[id_js_1.DeviceModelId.ORIGINAL],
      SUPPORTS_RGB_KEY_FILL: false,
      CONTROLS: (0, controlsGenerator_js_1.freezeDefinitions)((0, controlsGenerator_js_1.generateButtonsGrid)(5, 3, { width: 72, height: 72 }, true)),
      KEY_SPACING_HORIZONTAL: 25,
      KEY_SPACING_VERTICAL: 25,
      FULLSCREEN_PANELS: 0
    };
    function StreamDeckOriginalFactory(device, options) {
      return (0, generic_gen1_js_1.StreamDeckGen1Factory)(device, options, originalProperties, new imageWriter_js_1.StreamdeckOriginalImageWriter(), { colorMode: "bgr", xFlip: true }, 3780);
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/6-key.js
var require_key = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/6-key.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeck6KeyFactory = StreamDeck6KeyFactory;
    var generic_gen1_js_1 = require_generic_gen1();
    var id_js_1 = require_id();
    var controlsGenerator_js_1 = require_controlsGenerator();
    var imageWriter_js_1 = require_imageWriter();
    var headerGenerator_js_1 = require_headerGenerator();
    var base6KeyProperties = {
      SUPPORTS_RGB_KEY_FILL: false,
      // TODO - verify this
      CONTROLS: (0, controlsGenerator_js_1.freezeDefinitions)((0, controlsGenerator_js_1.generateButtonsGrid)(3, 2, { width: 80, height: 80 })),
      KEY_SPACING_HORIZONTAL: 28,
      KEY_SPACING_VERTICAL: 28,
      FULLSCREEN_PANELS: 0
    };
    function StreamDeck6KeyFactory(model, device, options, _tcpPropertiesService) {
      const properties = {
        ...base6KeyProperties,
        MODEL: model,
        PRODUCT_NAME: id_js_1.MODEL_NAMES[model]
      };
      return (0, generic_gen1_js_1.StreamDeckGen1Factory)(device, options, properties, new imageWriter_js_1.StreamdeckDefaultImageWriter(new headerGenerator_js_1.StreamdeckGen1ImageHeaderGenerator()), { colorMode: "bgr", rotate: true, yFlip: true }, 2835);
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/properties/gen2.js
var require_gen2 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/properties/gen2.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Gen2PropertiesService = void 0;
    var Gen2PropertiesService = class {
      device;
      constructor(device) {
        this.device = device;
      }
      async setBrightness(percentage) {
        if (percentage < 0 || percentage > 100) {
          throw new RangeError("Expected brightness percentage to be between 0 and 100");
        }
        const brightnessCommandBuffer = new Uint8Array([
          3,
          8,
          percentage,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]);
        await this.device.sendFeatureReport(brightnessCommandBuffer);
      }
      async resetToLogo() {
        const resetCommandBuffer = new Uint8Array([
          3,
          2,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]);
        await this.device.sendFeatureReport(resetCommandBuffer);
      }
      async getFirmwareVersion() {
        const val = await this.device.getFeatureReport(5, 32);
        const end = val[1] + 2;
        return new TextDecoder("ascii").decode(val.subarray(6, end));
      }
      async getAllFirmwareVersions() {
        return {
          AP2: await this.getFirmwareVersion()
          // TODO AP2_CHECKSUM - uint32be after length
        };
      }
      async getSerialNumber() {
        const val = await this.device.getFeatureReport(6, 32);
        const end = val[1] + 2;
        return new TextDecoder("ascii").decode(val.subarray(2, end));
      }
    };
    exports.Gen2PropertiesService = Gen2PropertiesService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/imagePacker/jpeg.js
var require_jpeg = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/imagePacker/jpeg.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.JpegButtonLcdImagePacker = void 0;
    var util_js_1 = require_util();
    var JpegButtonLcdImagePacker = class {
      #encodeJPEG;
      #transform;
      constructor(encodeJPEG, transform) {
        this.#encodeJPEG = encodeJPEG;
        this.#transform = transform;
      }
      async convertPixelBuffer(sourceBuffer, sourceOptions, targetSize) {
        const byteBuffer = (0, util_js_1.transformImageBuffer)(sourceBuffer, sourceOptions, { ...this.#transform, colorMode: "rgba" }, 0, targetSize.width, targetSize.height);
        return this.#encodeJPEG(byteBuffer, targetSize.width, targetSize.height);
      }
    };
    exports.JpegButtonLcdImagePacker = JpegButtonLcdImagePacker;
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/input/gen2.js
var require_gen22 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/input/gen2.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Gen2InputService = void 0;
    var gen1_js_1 = require_gen12();
    var util_js_1 = require_util();
    var Gen2InputService = class extends gen1_js_1.ButtonOnlyInputService {
      #eventSource;
      #encoderControls;
      #encoderState;
      #lcdSegmentControls;
      constructor(deviceProperties, eventSource) {
        super(deviceProperties, eventSource);
        this.#eventSource = eventSource;
        this.#encoderControls = deviceProperties.CONTROLS.filter((control) => control.type === "encoder");
        const maxIndex = Math.max(-1, ...this.#encoderControls.map((control) => control.index));
        this.#encoderState = new Array(maxIndex + 1).fill(false);
        this.#lcdSegmentControls = deviceProperties.CONTROLS.filter((control) => control.type === "lcd-segment");
      }
      handleInput(data) {
        const inputType = data[0];
        switch (inputType) {
          case 0:
            super.handleInput(data);
            break;
          case 2:
            this.#handleLcdSegmentInput(data);
            break;
          case 3:
            this.#handleEncoderInput(data);
            break;
          case 4:
            this.#handleNfcRead(data);
            break;
        }
      }
      #handleLcdSegmentInput(data) {
        const lcdSegmentControl = this.#lcdSegmentControls.find((control) => control.id === 0);
        if (!lcdSegmentControl)
          return;
        const bufferView = (0, util_js_1.uint8ArrayToDataView)(data);
        const position = {
          x: bufferView.getUint16(5, true),
          y: bufferView.getUint16(7, true)
        };
        switch (data[3]) {
          case 1:
            this.#eventSource.emit("lcdShortPress", lcdSegmentControl, position);
            break;
          case 2:
            this.#eventSource.emit("lcdLongPress", lcdSegmentControl, position);
            break;
          case 3: {
            const positionTo = {
              x: bufferView.getUint16(9, true),
              y: bufferView.getUint16(11, true)
            };
            this.#eventSource.emit("lcdSwipe", lcdSegmentControl, position, positionTo);
            break;
          }
        }
      }
      #handleEncoderInput(data) {
        switch (data[3]) {
          case 0:
            for (const encoderControl of this.#encoderControls) {
              const keyPressed = Boolean(data[4 + encoderControl.hidIndex]);
              const stateChanged = keyPressed !== this.#encoderState[encoderControl.index];
              if (stateChanged) {
                this.#encoderState[encoderControl.index] = keyPressed;
                if (keyPressed) {
                  this.#eventSource.emit("down", encoderControl);
                } else {
                  this.#eventSource.emit("up", encoderControl);
                }
              }
            }
            break;
          case 1:
            for (const encoderControl of this.#encoderControls) {
              const intArray = new Int8Array(data.buffer, data.byteOffset, data.byteLength);
              const value = intArray[4 + encoderControl.hidIndex];
              if (value !== 0) {
                this.#eventSource.emit("rotate", encoderControl, value);
              }
            }
            break;
        }
      }
      #handleNfcRead(data) {
        if (!this.deviceProperties.HAS_NFC_READER)
          return;
        const length = data[1] + data[2] * 256;
        const id = new TextDecoder("ascii").decode(data.subarray(3, 3 + length));
        this.#eventSource.emit("nfcRead", id);
      }
    };
    exports.Gen2InputService = Gen2InputService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/generic-gen2.js
var require_generic_gen2 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/generic-gen2.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.createBaseGen2Properties = createBaseGen2Properties;
    var imageWriter_js_1 = require_imageWriter();
    var headerGenerator_js_1 = require_headerGenerator();
    var default_js_1 = require_default();
    var callback_hook_js_1 = require_callback_hook();
    var gen2_js_1 = require_gen2();
    var jpeg_js_1 = require_jpeg();
    var gen2_js_2 = require_gen22();
    function extendDevicePropertiesForGen2(rawProps) {
      return {
        ...rawProps,
        KEY_DATA_OFFSET: 3
      };
    }
    function createBaseGen2Properties(device, options, properties, propertiesService, transform) {
      const fullProperties = extendDevicePropertiesForGen2(properties);
      const events = new callback_hook_js_1.CallbackHook();
      return {
        deviceProperties: fullProperties,
        events,
        properties: propertiesService ?? new gen2_js_1.Gen2PropertiesService(device),
        buttonsLcd: new default_js_1.DefaultButtonsLcdService(new imageWriter_js_1.StreamdeckDefaultImageWriter(new headerGenerator_js_1.StreamdeckGen2ImageHeaderGenerator()), new jpeg_js_1.JpegButtonLcdImagePacker(options.encodeJPEG, transform ?? { xFlip: true, yFlip: true }), device, fullProperties),
        lcdSegmentDisplay: null,
        inputService: new gen2_js_2.Gen2InputService(fullProperties, events),
        encoderLed: null
      };
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/32-key.js
var require_key2 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/32-key.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeck32KeyFactory = StreamDeck32KeyFactory;
    var base_js_1 = require_base();
    var generic_gen2_js_1 = require_generic_gen2();
    var id_js_1 = require_id();
    var controlsGenerator_js_1 = require_controlsGenerator();
    var base32KeyProperties = {
      SUPPORTS_RGB_KEY_FILL: true,
      CONTROLS: (0, controlsGenerator_js_1.freezeDefinitions)((0, controlsGenerator_js_1.generateButtonsGrid)(8, 4, { width: 96, height: 96 })),
      KEY_SPACING_HORIZONTAL: 32,
      KEY_SPACING_VERTICAL: 39,
      FULLSCREEN_PANELS: 1,
      HAS_NFC_READER: false,
      SUPPORTS_CHILD_DEVICES: false
    };
    function StreamDeck32KeyFactory(model, device, options, _tcpPropertiesService) {
      const properties = {
        ...base32KeyProperties,
        MODEL: model,
        PRODUCT_NAME: id_js_1.MODEL_NAMES[model]
      };
      const services = (0, generic_gen2_js_1.createBaseGen2Properties)(device, options, properties, null);
      return new base_js_1.StreamDeckBase(device, options, services);
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/15-key.js
var require_key3 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/15-key.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeck15KeyFactory = StreamDeck15KeyFactory;
    var base_js_1 = require_base();
    var generic_gen2_js_1 = require_generic_gen2();
    var id_js_1 = require_id();
    var controlsGenerator_js_1 = require_controlsGenerator();
    var base15KeyProperties = {
      SUPPORTS_RGB_KEY_FILL: true,
      CONTROLS: (0, controlsGenerator_js_1.freezeDefinitions)((0, controlsGenerator_js_1.generateButtonsGrid)(5, 3, { width: 72, height: 72 })),
      KEY_SPACING_HORIZONTAL: 25,
      KEY_SPACING_VERTICAL: 25,
      FULLSCREEN_PANELS: 1,
      HAS_NFC_READER: false,
      SUPPORTS_CHILD_DEVICES: false
    };
    function StreamDeck15KeyFactory(model, device, options, _tcpPropertiesService) {
      const properties = {
        ...base15KeyProperties,
        MODEL: model,
        PRODUCT_NAME: id_js_1.MODEL_NAMES[model]
      };
      const services = (0, generic_gen2_js_1.createBaseGen2Properties)(device, options, properties, null);
      return new base_js_1.StreamDeckBase(device, options, services);
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/lcdSegmentDisplay/generic.js
var require_generic = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/lcdSegmentDisplay/generic.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamdeckDefaultLcdService = void 0;
    var headerGenerator_js_1 = require_headerGenerator();
    var imageWriter_js_1 = require_imageWriter();
    var util_js_1 = require_util();
    var preparedBuffer_js_1 = require_preparedBuffer();
    var StreamdeckDefaultLcdService = class {
      #encodeJPEG;
      #device;
      #lcdControls;
      #rotate;
      #modelId;
      #lcdImageWriter = new imageWriter_js_1.StreamdeckDefaultImageWriter(new headerGenerator_js_1.StreamdeckDefaultLcdImageHeaderGenerator());
      constructor(encodeJPEG, device, lcdControls, rotate, modelId) {
        this.#encodeJPEG = encodeJPEG;
        this.#device = device;
        this.#lcdControls = lcdControls;
        this.#rotate = rotate;
        this.#modelId = modelId;
      }
      async fillLcd(index, buffer, sourceOptions) {
        const lcdControl = this.#lcdControls.find((control) => control.id === index);
        if (!lcdControl)
          throw new Error(`Invalid lcd segment index ${index}`);
        const packets = await this.prepareFillControlRegion(lcdControl, 0, 0, buffer, {
          format: sourceOptions.format,
          width: lcdControl.pixelSize.width,
          height: lcdControl.pixelSize.height
        });
        await this.#device.sendReports(packets);
      }
      async fillLcdRegion(index, x, y, imageBuffer, sourceOptions) {
        const lcdControl = this.#lcdControls.find((control) => control.id === index);
        if (!lcdControl)
          throw new Error(`Invalid lcd segment index ${index}`);
        const packets = await this.prepareFillControlRegion(lcdControl, x, y, imageBuffer, sourceOptions);
        await this.#device.sendReports(packets);
      }
      async prepareFillLcdRegion(index, x, y, imageBuffer, sourceOptions, jsonSafe) {
        const lcdControl = this.#lcdControls.find((control) => control.id === index);
        if (!lcdControl)
          throw new Error(`Invalid lcd segment index ${index}`);
        const packets = await this.prepareFillControlRegion(lcdControl, x, y, imageBuffer, sourceOptions);
        return (0, preparedBuffer_js_1.wrapBufferToPreparedBuffer)(this.#modelId, "fill-lcd-region", packets, jsonSafe ?? false);
      }
      async clearLcdSegment(index) {
        const lcdControl = this.#lcdControls.find((control) => control.id === index);
        if (!lcdControl)
          throw new Error(`Invalid lcd segment index ${index}`);
        const buffer = new Uint8Array(lcdControl.pixelSize.width * lcdControl.pixelSize.height * 4);
        const packets = await this.prepareFillControlRegion(lcdControl, 0, 0, buffer, {
          format: "rgba",
          width: lcdControl.pixelSize.width,
          height: lcdControl.pixelSize.height
        });
        await this.#device.sendReports(packets);
      }
      async clearAllLcdSegments() {
        const ps = [];
        for (const control of this.#lcdControls) {
          ps.push(this.clearLcdSegment(control.id));
        }
        await Promise.all(ps);
      }
      async prepareFillControlRegion(lcdControl, x, y, imageBuffer, sourceOptions) {
        const maxSize = lcdControl.pixelSize;
        if (x < 0 || x + sourceOptions.width > maxSize.width) {
          throw new TypeError(`Image will not fit within the lcd segment`);
        }
        if (y < 0 || y + sourceOptions.height > maxSize.height) {
          throw new TypeError(`Image will not fit within the lcd segment`);
        }
        const imageSize = sourceOptions.width * sourceOptions.height * sourceOptions.format.length;
        if (imageBuffer.length !== imageSize) {
          throw new RangeError(`Expected image buffer of length ${imageSize}, got length ${imageBuffer.length}`);
        }
        const byteBuffer = await this.convertFillLcdBuffer(imageBuffer, sourceOptions);
        return this.#lcdImageWriter.generateFillImageWrites({ ...sourceOptions, x, y }, byteBuffer);
      }
      async convertFillLcdBuffer(sourceBuffer, sourceOptions) {
        const sourceOptions2 = {
          format: sourceOptions.format,
          offset: 0,
          stride: sourceOptions.width * sourceOptions.format.length
        };
        const byteBuffer = (0, util_js_1.transformImageBuffer)(sourceBuffer, sourceOptions2, { colorMode: "rgba", rotate: this.#rotate, yFlip: this.#rotate }, 0, sourceOptions.width, sourceOptions.height);
        return this.#encodeJPEG(byteBuffer, this.#rotate ? sourceOptions.height : sourceOptions.width, this.#rotate ? sourceOptions.width : sourceOptions.height);
      }
    };
    exports.StreamdeckDefaultLcdService = StreamdeckDefaultLcdService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/plus.js
var require_plus = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/plus.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeckPlusFactory = StreamDeckPlusFactory;
    var base_js_1 = require_base();
    var generic_gen2_js_1 = require_generic_gen2();
    var id_js_1 = require_id();
    var controlsGenerator_js_1 = require_controlsGenerator();
    var generic_js_1 = require_generic();
    var plusControls = (0, controlsGenerator_js_1.generateButtonsGrid)(4, 2, { width: 120, height: 120 });
    plusControls.push({
      type: "lcd-segment",
      row: 2,
      column: 0,
      columnSpan: 4,
      rowSpan: 1,
      id: 0,
      pixelSize: Object.freeze({
        width: 800,
        height: 100
      }),
      drawRegions: true
    }, {
      type: "encoder",
      row: 3,
      column: 0,
      index: 0,
      hidIndex: 0,
      hasLed: false,
      ledRingSteps: 0
    }, {
      type: "encoder",
      row: 3,
      column: 1,
      index: 1,
      hidIndex: 1,
      hasLed: false,
      ledRingSteps: 0
    }, {
      type: "encoder",
      row: 3,
      column: 2,
      index: 2,
      hidIndex: 2,
      hasLed: false,
      ledRingSteps: 0
    }, {
      type: "encoder",
      row: 3,
      column: 3,
      index: 3,
      hidIndex: 3,
      hasLed: false,
      ledRingSteps: 0
    });
    var plusProperties = {
      MODEL: id_js_1.DeviceModelId.PLUS,
      PRODUCT_NAME: id_js_1.MODEL_NAMES[id_js_1.DeviceModelId.PLUS],
      SUPPORTS_RGB_KEY_FILL: true,
      CONTROLS: (0, controlsGenerator_js_1.freezeDefinitions)(plusControls),
      KEY_SPACING_HORIZONTAL: 99,
      KEY_SPACING_VERTICAL: 40,
      FULLSCREEN_PANELS: 1,
      HAS_NFC_READER: false,
      SUPPORTS_CHILD_DEVICES: false
    };
    var lcdSegmentControls = plusProperties.CONTROLS.filter((control) => control.type === "lcd-segment");
    function StreamDeckPlusFactory(device, options) {
      const services = (0, generic_gen2_js_1.createBaseGen2Properties)(device, options, plusProperties, null, { xFlip: false, yFlip: false });
      services.lcdSegmentDisplay = new generic_js_1.StreamdeckDefaultLcdService(options.encodeJPEG, device, lcdSegmentControls, false, id_js_1.DeviceModelId.PLUS);
      return new base_js_1.StreamDeckBase(device, options, services);
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/properties/pedal.js
var require_pedal = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/properties/pedal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PedalPropertiesService = void 0;
    var PedalPropertiesService = class {
      #device;
      constructor(device) {
        this.#device = device;
      }
      async setBrightness(_percentage) {
      }
      async resetToLogo() {
      }
      async getFirmwareVersion() {
        const val = await this.#device.getFeatureReport(5, 32);
        const end = val.indexOf(0, 6);
        return new TextDecoder("ascii").decode(val.subarray(6, end === -1 ? void 0 : end));
      }
      async getAllFirmwareVersions() {
        return {
          AP2: await this.getFirmwareVersion()
        };
      }
      async getSerialNumber() {
        const val = await this.#device.getFeatureReport(6, 32);
        return new TextDecoder("ascii").decode(val.subarray(2, 14));
      }
    };
    exports.PedalPropertiesService = PedalPropertiesService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/buttonsLcdDisplay/fake.js
var require_fake = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/buttonsLcdDisplay/fake.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FakeLcdService = void 0;
    var FakeLcdService = class {
      calculateFillPanelDimensions(_options) {
        return null;
      }
      async clearKey(_keyIndex) {
      }
      async clearPanel() {
      }
      async fillKeyColor(_keyIndex, _r, _g, _b) {
      }
      async fillKeyBuffer(_keyIndex, _imageBuffer, _options) {
      }
      async prepareFillKeyBuffer(_keyIndex, _imageBuffer, _options, _jsonSafe) {
        throw new Error("Not supported");
      }
      async fillPanelBuffer(_imageBuffer, _options) {
      }
      async prepareFillPanelBuffer(_imageBuffer, _options, _jsonSafe) {
        throw new Error("Not supported");
      }
    };
    exports.FakeLcdService = FakeLcdService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/pedal.js
var require_pedal2 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/pedal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeckPedalFactory = StreamDeckPedalFactory;
    var base_js_1 = require_base();
    var id_js_1 = require_id();
    var controlsGenerator_js_1 = require_controlsGenerator();
    var pedal_js_1 = require_pedal();
    var fake_js_1 = require_fake();
    var callback_hook_js_1 = require_callback_hook();
    var gen1_js_1 = require_gen12();
    var pedalControls = [
      {
        type: "button",
        row: 0,
        column: 0,
        index: 0,
        hidIndex: 0,
        feedbackType: "none"
      },
      {
        type: "button",
        row: 0,
        column: 1,
        index: 1,
        hidIndex: 1,
        feedbackType: "none"
      },
      {
        type: "button",
        row: 0,
        column: 2,
        index: 2,
        hidIndex: 2,
        feedbackType: "none"
      }
    ];
    var pedalProperties = {
      MODEL: id_js_1.DeviceModelId.PEDAL,
      PRODUCT_NAME: id_js_1.MODEL_NAMES[id_js_1.DeviceModelId.PEDAL],
      KEY_DATA_OFFSET: 3,
      SUPPORTS_RGB_KEY_FILL: false,
      CONTROLS: (0, controlsGenerator_js_1.freezeDefinitions)(pedalControls),
      KEY_SPACING_HORIZONTAL: 0,
      KEY_SPACING_VERTICAL: 0,
      FULLSCREEN_PANELS: 0,
      HAS_NFC_READER: false,
      SUPPORTS_CHILD_DEVICES: false
    };
    function StreamDeckPedalFactory(device, options) {
      const events = new callback_hook_js_1.CallbackHook();
      return new base_js_1.StreamDeckBase(device, options, {
        deviceProperties: pedalProperties,
        events,
        properties: new pedal_js_1.PedalPropertiesService(device),
        buttonsLcd: new fake_js_1.FakeLcdService(),
        lcdSegmentDisplay: null,
        inputService: new gen1_js_1.ButtonOnlyInputService(pedalProperties, events),
        encoderLed: null
      });
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/lcdSegmentDisplay/neo.js
var require_neo = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/lcdSegmentDisplay/neo.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeckNeoLcdService = void 0;
    var headerGenerator_js_1 = require_headerGenerator();
    var imageWriter_js_1 = require_imageWriter();
    var util_js_1 = require_util();
    var StreamDeckNeoLcdService = class {
      #encodeJPEG;
      #device;
      #lcdControls;
      #lcdImageWriter = new imageWriter_js_1.StreamdeckDefaultImageWriter(new headerGenerator_js_1.StreamdeckNeoLcdImageHeaderGenerator());
      constructor(encodeJPEG, device, lcdControls) {
        this.#encodeJPEG = encodeJPEG;
        this.#device = device;
        this.#lcdControls = lcdControls;
      }
      async fillLcdRegion(_index, _x, _y, _imageBuffer, _sourceOptions) {
        throw new Error("Not supported for this model");
      }
      async prepareFillLcdRegion(_index, _x, _y, _imageBuffer, _sourceOptions, _jsonSafe) {
        throw new Error("Not supported for this model");
      }
      async fillLcd(index, imageBuffer, sourceOptions) {
        const lcdControl = this.#lcdControls.find((control) => control.id === index);
        if (!lcdControl)
          throw new Error(`Invalid lcd segment index ${index}`);
        const imageSize = lcdControl.pixelSize.width * lcdControl.pixelSize.height * sourceOptions.format.length;
        if (imageBuffer.length !== imageSize) {
          throw new RangeError(`Expected image buffer of length ${imageSize}, got length ${imageBuffer.length}`);
        }
        const byteBuffer = await this.convertFillLcdBuffer(imageBuffer, lcdControl.pixelSize, sourceOptions);
        const packets = this.#lcdImageWriter.generateFillImageWrites(null, byteBuffer);
        await this.#device.sendReports(packets);
      }
      async clearLcdSegment(index) {
        const lcdControl = this.#lcdControls.find((control) => control.id === index);
        if (!lcdControl)
          throw new Error(`Invalid lcd segment index ${index}`);
        const buffer = new Uint8Array(lcdControl.pixelSize.width * lcdControl.pixelSize.height * 4);
        await this.fillLcd(index, buffer, {
          format: "rgba"
        });
      }
      async clearAllLcdSegments() {
        const ps = [];
        for (const control of this.#lcdControls) {
          ps.push(this.clearLcdSegment(control.id));
        }
        await Promise.all(ps);
      }
      async convertFillLcdBuffer(sourceBuffer, size, sourceOptions) {
        const sourceOptions2 = {
          format: sourceOptions.format,
          offset: 0,
          stride: size.width * sourceOptions.format.length
        };
        const byteBuffer = (0, util_js_1.transformImageBuffer)(sourceBuffer, sourceOptions2, { colorMode: "rgba", xFlip: true, yFlip: true }, 0, size.width, size.height);
        return this.#encodeJPEG(byteBuffer, size.width, size.height);
      }
    };
    exports.StreamDeckNeoLcdService = StreamDeckNeoLcdService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/neo.js
var require_neo2 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/neo.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeckNeoFactory = StreamDeckNeoFactory;
    var base_js_1 = require_base();
    var id_js_1 = require_id();
    var generic_gen2_js_1 = require_generic_gen2();
    var controlsGenerator_js_1 = require_controlsGenerator();
    var neo_js_1 = require_neo();
    var neoControls = (0, controlsGenerator_js_1.generateButtonsGrid)(4, 2, { width: 96, height: 96 });
    neoControls.push({
      type: "button",
      row: 2,
      column: 0,
      index: 8,
      hidIndex: 8,
      feedbackType: "rgb"
    }, {
      type: "lcd-segment",
      row: 2,
      column: 1,
      columnSpan: 2,
      rowSpan: 1,
      id: 0,
      pixelSize: {
        width: 248,
        height: 58
      },
      drawRegions: false
    }, {
      type: "button",
      row: 2,
      column: 3,
      index: 9,
      hidIndex: 9,
      feedbackType: "rgb"
    });
    var neoProperties = {
      MODEL: id_js_1.DeviceModelId.NEO,
      PRODUCT_NAME: id_js_1.MODEL_NAMES[id_js_1.DeviceModelId.NEO],
      CONTROLS: (0, controlsGenerator_js_1.freezeDefinitions)(neoControls),
      KEY_SPACING_HORIZONTAL: 30,
      KEY_SPACING_VERTICAL: 30,
      FULLSCREEN_PANELS: 1,
      HAS_NFC_READER: false,
      SUPPORTS_CHILD_DEVICES: false,
      SUPPORTS_RGB_KEY_FILL: true
    };
    var lcdSegmentControls = neoProperties.CONTROLS.filter((control) => control.type === "lcd-segment");
    function StreamDeckNeoFactory(device, options) {
      const services = (0, generic_gen2_js_1.createBaseGen2Properties)(device, options, neoProperties, null);
      services.lcdSegmentDisplay = new neo_js_1.StreamDeckNeoLcdService(options.encodeJPEG, device, lcdSegmentControls);
      return new base_js_1.StreamDeckBase(device, options, services);
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/properties/all-firmware.js
var require_all_firmware = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/properties/all-firmware.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseAllFirmwareVersionsHelper = parseAllFirmwareVersionsHelper;
    var util_js_1 = require_util();
    async function parseAllFirmwareVersionsHelper(reportData) {
      const decoder = new TextDecoder("ascii");
      const versions = {};
      if (reportData.ap2) {
        const ap2DataDataView = (0, util_js_1.uint8ArrayToDataView)(reportData.ap2);
        versions.AP2 = decoder.decode(reportData.ap2.subarray(6, 6 + 8));
        versions.AP2_CHECKSUM = ap2DataDataView.getUint32(2, false).toString(16);
      }
      if (reportData.encoderLd && (reportData.encoderLd[0] === 24 || reportData.encoderLd[1] === 24)) {
        const encoderLdDataView = (0, util_js_1.uint8ArrayToDataView)(reportData.encoderLd);
        versions.ENCODER_LD = decoder.decode(reportData.encoderLd.subarray(2, 2 + 8));
        versions.ENCODER_LD_CHECKSUM = encoderLdDataView.getUint32(10, false).toString(16);
      }
      if (reportData.encoderAp2 && (reportData.encoderAp2[0] === 24 || reportData.encoderAp2[1] === 24)) {
        const encoderAp2DataView = (0, util_js_1.uint8ArrayToDataView)(reportData.encoderAp2);
        versions.ENCODER_AP2 = decoder.decode(reportData.encoderAp2.subarray(2, 2 + 8));
        versions.ENCODER_AP2_CHECKSUM = encoderAp2DataView.getUint32(10, false).toString(16);
      }
      return versions;
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/properties/studio.js
var require_studio = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/properties/studio.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StudioPropertiesService = void 0;
    var all_firmware_js_1 = require_all_firmware();
    var gen2_js_1 = require_gen2();
    var StudioPropertiesService = class extends gen2_js_1.Gen2PropertiesService {
      async getAllFirmwareVersions() {
        const [ap2Data, encoderAp2Data, encoderLdData] = await Promise.all([
          this.device.getFeatureReport(5, 32),
          this.device.getFeatureReport(17, 32),
          this.device.getFeatureReport(19, 32)
        ]);
        return (0, all_firmware_js_1.parseAllFirmwareVersionsHelper)({
          ap2: ap2Data,
          encoderAp2: encoderAp2Data,
          encoderLd: encoderLdData
        });
      }
    };
    exports.StudioPropertiesService = StudioPropertiesService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/encoderLed/studio.js
var require_studio2 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/encoderLed/studio.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StudioEncoderLedService = void 0;
    var StudioEncoderLedService = class {
      #device;
      #encoderControls;
      constructor(device, allControls) {
        this.#device = device;
        this.#encoderControls = allControls.filter((control) => control.type === "encoder");
      }
      async clearAll() {
        const ps = [];
        for (const control of this.#encoderControls) {
          if (control.hasLed)
            ps.push(this.setEncoderColor(control.index, 0, 0, 0));
          if (control.ledRingSteps > 0)
            ps.push(this.setEncoderRingSingleColor(control.index, 0, 0, 0));
        }
        await Promise.all(ps);
      }
      async setEncoderColor(encoder, red, green, blue) {
        const control = this.#encoderControls.find((c) => c.index === encoder);
        if (!control)
          throw new Error(`Invalid encoder index ${encoder}`);
        if (!control.hasLed)
          throw new Error("Encoder does not have an LED");
        const buffer = new Uint8Array(1024);
        buffer[0] = 2;
        buffer[1] = 16;
        buffer[2] = encoder;
        buffer[3] = red;
        buffer[4] = green;
        buffer[5] = blue;
        await this.#device.sendReports([buffer]);
      }
      async setEncoderRingSingleColor(encoder, red, green, blue) {
        const control = this.#encoderControls.find((c) => c.index === encoder);
        if (!control)
          throw new Error(`Invalid encoder index ${encoder}`);
        if (control.ledRingSteps <= 0)
          throw new Error("Encoder does not have an LED ring");
        const buffer = new Uint8Array(1024);
        buffer[0] = 2;
        buffer[1] = 15;
        buffer[2] = encoder;
        for (let i = 0; i < control.ledRingSteps; i++) {
          const offset = 3 + i * 3;
          buffer[offset] = red;
          buffer[offset + 1] = green;
          buffer[offset + 2] = blue;
        }
        await this.#device.sendReports([buffer]);
      }
      async setEncoderRingColors(encoder, colors) {
        const control = this.#encoderControls.find((c) => c.index === encoder);
        if (!control)
          throw new Error(`Invalid encoder index ${encoder}`);
        if (control.ledRingSteps <= 0)
          throw new Error("Encoder does not have an LED ring");
        if (colors.length !== control.ledRingSteps * 3)
          throw new Error("Invalid colors length");
        let colorsBuffer = colors instanceof Uint8Array ? colors : new Uint8Array(colors);
        if (control.lcdRingOffset) {
          const oldColorsBuffer = colorsBuffer;
          colorsBuffer = new Uint8Array(oldColorsBuffer.length);
          colorsBuffer.set(oldColorsBuffer.slice(control.lcdRingOffset * 3), 0);
          colorsBuffer.set(oldColorsBuffer.slice(0, control.lcdRingOffset * 3), control.lcdRingOffset * 3);
        }
        const buffer = new Uint8Array(1024);
        buffer[0] = 2;
        buffer[1] = 15;
        buffer[2] = encoder;
        buffer.set(colorsBuffer, 3);
        await this.#device.sendReports([buffer]);
      }
    };
    exports.StudioEncoderLedService = StudioEncoderLedService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/studio.js
var require_studio3 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/studio.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.studioProperties = void 0;
    exports.StreamDeckStudioFactory = StreamDeckStudioFactory;
    var base_js_1 = require_base();
    var generic_gen2_js_1 = require_generic_gen2();
    var id_js_1 = require_id();
    var controlsGenerator_js_1 = require_controlsGenerator();
    var studio_js_1 = require_studio();
    var studio_js_2 = require_studio2();
    var studioControls = [
      {
        type: "encoder",
        row: 0,
        column: 0,
        index: 0,
        hidIndex: 0,
        hasLed: true,
        ledRingSteps: 24
      },
      ...(0, controlsGenerator_js_1.generateButtonsGrid)(16, 2, { width: 144, height: 112 }, false, 1),
      {
        type: "encoder",
        row: 0,
        column: 17,
        index: 1,
        hidIndex: 1,
        hasLed: true,
        ledRingSteps: 24,
        lcdRingOffset: 12
      }
    ];
    exports.studioProperties = {
      MODEL: id_js_1.DeviceModelId.STUDIO,
      PRODUCT_NAME: id_js_1.MODEL_NAMES[id_js_1.DeviceModelId.STUDIO],
      SUPPORTS_RGB_KEY_FILL: true,
      CONTROLS: (0, controlsGenerator_js_1.freezeDefinitions)(studioControls),
      KEY_SPACING_HORIZONTAL: 0,
      // TODO
      KEY_SPACING_VERTICAL: 0,
      // TODO
      FULLSCREEN_PANELS: 2,
      HAS_NFC_READER: true,
      SUPPORTS_CHILD_DEVICES: true
    };
    function StreamDeckStudioFactory(device, options, propertiesService) {
      const services = (0, generic_gen2_js_1.createBaseGen2Properties)(device, options, exports.studioProperties, propertiesService ?? new studio_js_1.StudioPropertiesService(device), { xFlip: false, yFlip: false });
      services.encoderLed = new studio_js_2.StudioEncoderLedService(device, studioControls);
      return new base_js_1.StreamDeckBase(device, options, services);
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/input/fake.js
var require_fake2 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/input/fake.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FakeInputService = void 0;
    var FakeInputService = class {
      handleInput(_data) {
      }
    };
    exports.FakeInputService = FakeInputService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/properties/network-dock.js
var require_network_dock = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/properties/network-dock.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NetworkDockPropertiesService = void 0;
    var all_firmware_js_1 = require_all_firmware();
    var NetworkDockPropertiesService = class {
      #device;
      constructor(device) {
        this.#device = device;
      }
      async setBrightness(_percentage) {
      }
      async resetToLogo() {
      }
      async getFirmwareVersion() {
        const data = await this.#device.getFeatureReport(131, -1);
        return new TextDecoder("ascii").decode(data.subarray(8, 16));
      }
      async getAllFirmwareVersions() {
        const [ap2Data] = await Promise.all([this.#device.getFeatureReport(131, -1)]);
        return (0, all_firmware_js_1.parseAllFirmwareVersionsHelper)({
          ap2: ap2Data.slice(2),
          encoderAp2: null,
          encoderLd: null
        });
      }
      async getSerialNumber() {
        const data = await this.#device.getFeatureReport(132, -1);
        const length = data[3];
        return new TextDecoder("ascii").decode(data.subarray(4, 4 + length));
      }
    };
    exports.NetworkDockPropertiesService = NetworkDockPropertiesService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/network-dock.js
var require_network_dock2 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/network-dock.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NetworkDockFactory = NetworkDockFactory;
    var base_js_1 = require_base();
    var id_js_1 = require_id();
    var controlsGenerator_js_1 = require_controlsGenerator();
    var callback_hook_js_1 = require_callback_hook();
    var fake_js_1 = require_fake();
    var fake_js_2 = require_fake2();
    var network_dock_js_1 = require_network_dock();
    var networkDockProperties = {
      MODEL: id_js_1.DeviceModelId.NETWORK_DOCK,
      PRODUCT_NAME: id_js_1.MODEL_NAMES[id_js_1.DeviceModelId.NETWORK_DOCK],
      KEY_DATA_OFFSET: 0,
      SUPPORTS_RGB_KEY_FILL: false,
      CONTROLS: (0, controlsGenerator_js_1.freezeDefinitions)([]),
      KEY_SPACING_HORIZONTAL: 0,
      KEY_SPACING_VERTICAL: 0,
      FULLSCREEN_PANELS: 0,
      HAS_NFC_READER: false,
      SUPPORTS_CHILD_DEVICES: true
    };
    function NetworkDockFactory(device, options, _tcpPropertiesService) {
      const events = new callback_hook_js_1.CallbackHook();
      return new base_js_1.StreamDeckBase(device, options, {
        deviceProperties: networkDockProperties,
        events,
        properties: new network_dock_js_1.NetworkDockPropertiesService(device),
        buttonsLcd: new fake_js_1.FakeLcdService(),
        lcdSegmentDisplay: null,
        inputService: new fake_js_2.FakeInputService(),
        encoderLed: null
      });
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/services/encoderLed/galleonK100.js
var require_galleonK100 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/services/encoderLed/galleonK100.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.GalleonK100EncoderLedService = void 0;
    var GalleonK100EncoderLedService = class {
      #device;
      #encoderControls;
      constructor(device, allControls) {
        this.#device = device;
        this.#encoderControls = allControls.filter((control) => control.type === "encoder");
      }
      async clearAll() {
        const ps = [];
        for (const control of this.#encoderControls) {
          if (control.ledRingSteps > 0)
            ps.push(this.setEncoderRingSingleColor(control.index, 0, 0, 0));
        }
        await Promise.all(ps);
      }
      async setEncoderColor(encoder, _red, _green, _blue) {
        const control = this.#encoderControls.find((c) => c.index === encoder);
        if (!control)
          throw new Error(`Invalid encoder index ${encoder}`);
        throw new Error("Encoder does not have an LED");
      }
      async setEncoderRingSingleColor(encoder, red, green, blue) {
        const control = this.#encoderControls.find((c) => c.index === encoder);
        if (!control)
          throw new Error(`Invalid encoder index ${encoder}`);
        if (control.ledRingSteps <= 0)
          throw new Error("Encoder does not have an LED ring");
        const offset = (1 - encoder) * control.ledRingSteps;
        const ps = [];
        for (let i = 0; i < control.ledRingSteps; i++) {
          ps.push(this.#sendEncoderPixelColor(offset + i, red, green, blue));
        }
        await Promise.all(ps);
      }
      async setEncoderRingColors(encoder, colors) {
        const control = this.#encoderControls.find((c) => c.index === encoder);
        if (!control)
          throw new Error(`Invalid encoder index ${encoder}`);
        if (control.ledRingSteps <= 0)
          throw new Error("Encoder does not have an LED ring");
        if (colors.length !== control.ledRingSteps * 3)
          throw new Error("Invalid colors length");
        let colorsArray = colors instanceof Uint8Array ? Array.from(colors) : colors;
        if (control.lcdRingOffset) {
          const oldColorsArray = colorsArray;
          colorsArray = [];
          colorsArray.push(...oldColorsArray.slice(control.lcdRingOffset * 3));
          colorsArray.push(...oldColorsArray.slice(0, control.lcdRingOffset * 3));
        }
        const offset = (1 - encoder) * control.ledRingSteps;
        const ps = [];
        for (let i = 0; i < control.ledRingSteps; i++) {
          ps.push(this.#sendEncoderPixelColor(offset + i, colorsArray[i * 3], colorsArray[i * 3 + 1], colorsArray[i * 3 + 2]));
        }
        await Promise.all(ps);
      }
      async #sendEncoderPixelColor(index, red, green, blue) {
        const buffer = new Uint8Array(6);
        buffer[0] = 3;
        buffer[1] = 36;
        buffer[2] = index;
        buffer[3] = red;
        buffer[4] = green;
        buffer[5] = blue;
        await this.#device.sendFeatureReport(buffer);
      }
    };
    exports.GalleonK100EncoderLedService = GalleonK100EncoderLedService;
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/galleon-k100.js
var require_galleon_k100 = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/galleon-k100.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.GalleonK100Factory = GalleonK100Factory;
    var base_js_1 = require_base();
    var generic_gen2_js_1 = require_generic_gen2();
    var id_js_1 = require_id();
    var controlsGenerator_js_1 = require_controlsGenerator();
    var galleonK100_js_1 = require_galleonK100();
    var generic_js_1 = require_generic();
    var k100Controls = (0, controlsGenerator_js_1.generateButtonsGrid)(3, 4, { width: 160, height: 160 }, false, 0, 2);
    k100Controls.push({
      type: "encoder",
      row: 0,
      column: 0,
      index: 0,
      hidIndex: 0,
      hasLed: false,
      ledRingSteps: 4,
      lcdRingOffset: 3
    }, {
      type: "encoder",
      row: 0,
      column: 2,
      index: 1,
      hidIndex: 1,
      hasLed: false,
      ledRingSteps: 4,
      lcdRingOffset: 1
    }, {
      type: "lcd-segment",
      row: 1,
      column: 0,
      columnSpan: 3,
      rowSpan: 1,
      id: 0,
      pixelSize: Object.freeze({
        width: 720,
        height: 384
      }),
      drawRegions: true
    });
    var galleonK100Properties = {
      MODEL: id_js_1.DeviceModelId.GALLEON_K100,
      PRODUCT_NAME: id_js_1.MODEL_NAMES[id_js_1.DeviceModelId.GALLEON_K100],
      SUPPORTS_RGB_KEY_FILL: true,
      CONTROLS: (0, controlsGenerator_js_1.freezeDefinitions)(k100Controls),
      KEY_SPACING_HORIZONTAL: 64,
      KEY_SPACING_VERTICAL: 64,
      FULLSCREEN_PANELS: 0,
      HAS_NFC_READER: false,
      SUPPORTS_CHILD_DEVICES: false
    };
    var lcdSegmentControls = galleonK100Properties.CONTROLS.filter((control) => control.type === "lcd-segment");
    async function GalleonK100Factory(device, options, _tcpPropertiesService) {
      const services = (0, generic_gen2_js_1.createBaseGen2Properties)(device, options, galleonK100Properties, null, {
        xFlip: false,
        yFlip: false
      });
      services.encoderLed = new galleonK100_js_1.GalleonK100EncoderLedService(device, galleonK100Properties.CONTROLS);
      services.lcdSegmentDisplay = new generic_js_1.StreamdeckDefaultLcdService(options.encodeJPEG, device, lcdSegmentControls, false, id_js_1.DeviceModelId.GALLEON_K100);
      const streamDeck = new GalleonK100StreamDeck(device, options, services);
      await new Promise((resolve) => setTimeout(resolve, 200));
      return streamDeck;
    }
    var GalleonK100StreamDeck = class extends base_js_1.StreamDeckBase {
      #pingInterval;
      constructor(device, options, services) {
        super(device, options, services);
        device.on("error", () => this.#stopPing());
        this.#pingInterval = setInterval(this.#sendPing, 500);
        this.#sendPing();
      }
      async close() {
        this.#stopPing();
        return super.close();
      }
      #sendPing = () => {
        this.device.sendFeatureReport(new Uint8Array([3, 39])).catch((e) => {
          this.emit("error", e);
          this.#stopPing();
        });
      };
      #stopPing() {
        clearInterval(this.#pingInterval);
      }
    };
  }
});

// node_modules/@elgato-stream-deck/core/dist/models/plus-xl.js
var require_plus_xl = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/models/plus-xl.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeckPlusXlFactory = StreamDeckPlusXlFactory;
    var base_js_1 = require_base();
    var generic_gen2_js_1 = require_generic_gen2();
    var id_js_1 = require_id();
    var controlsGenerator_js_1 = require_controlsGenerator();
    var generic_js_1 = require_generic();
    var plusXlControls = (0, controlsGenerator_js_1.generateButtonsGrid)(9, 4, { width: 112, height: 112 });
    plusXlControls.push({
      type: "lcd-segment",
      row: 4,
      column: 0,
      columnSpan: 9,
      rowSpan: 1,
      id: 0,
      pixelSize: Object.freeze({
        width: 1200,
        height: 100
      }),
      drawRegions: true
    }, {
      type: "encoder",
      row: 5,
      column: 0,
      index: 0,
      hidIndex: 0,
      hasLed: false,
      ledRingSteps: 0
    }, {
      type: "encoder",
      row: 5,
      column: 2,
      index: 1,
      hidIndex: 1,
      hasLed: false,
      ledRingSteps: 0
    }, {
      type: "encoder",
      row: 5,
      column: 3,
      index: 2,
      hidIndex: 2,
      hasLed: false,
      ledRingSteps: 0
    }, {
      type: "encoder",
      row: 5,
      column: 5,
      index: 3,
      hidIndex: 3,
      hasLed: false,
      ledRingSteps: 0
    }, {
      type: "encoder",
      row: 5,
      column: 6,
      index: 4,
      hidIndex: 4,
      hasLed: false,
      ledRingSteps: 0
    }, {
      type: "encoder",
      row: 5,
      column: 8,
      index: 5,
      hidIndex: 5,
      hasLed: false,
      ledRingSteps: 0
    });
    var plusXlProperties = {
      MODEL: id_js_1.DeviceModelId.PLUS_XL,
      PRODUCT_NAME: id_js_1.MODEL_NAMES[id_js_1.DeviceModelId.PLUS_XL],
      SUPPORTS_RGB_KEY_FILL: true,
      CONTROLS: (0, controlsGenerator_js_1.freezeDefinitions)(plusXlControls),
      KEY_SPACING_HORIZONTAL: 99,
      KEY_SPACING_VERTICAL: 40,
      FULLSCREEN_PANELS: 1,
      HAS_NFC_READER: false,
      SUPPORTS_CHILD_DEVICES: false
    };
    var lcdSegmentControls = plusXlProperties.CONTROLS.filter((control) => control.type === "lcd-segment");
    function StreamDeckPlusXlFactory(device, options) {
      const services = (0, generic_gen2_js_1.createBaseGen2Properties)(device, options, plusXlProperties, null, {
        rotate: true,
        yFlip: true
      });
      services.lcdSegmentDisplay = new generic_js_1.StreamdeckDefaultLcdService(options.encodeJPEG, device, lcdSegmentControls, true, id_js_1.DeviceModelId.PLUS_XL);
      return new base_js_1.StreamDeckBase(device, options, services);
    }
  }
});

// node_modules/@elgato-stream-deck/core/dist/types.js
var require_types = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/@elgato-stream-deck/core/dist/controlDefinition.js
var require_controlDefinition = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/controlDefinition.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
  }
});

// node_modules/@elgato-stream-deck/core/dist/proxy.js
var require_proxy = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/proxy.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeckProxy = void 0;
    var StreamDeckProxy = class {
      device;
      constructor(device) {
        this.device = device;
      }
      get CONTROLS() {
        return this.device.CONTROLS;
      }
      // public get KEY_SPACING_VERTICAL(): number {
      // 	return this.device.KEY_SPACING_VERTICAL
      // }
      // public get KEY_SPACING_HORIZONTAL(): number {
      // 	return this.device.KEY_SPACING_HORIZONTAL
      // }
      get MODEL() {
        return this.device.MODEL;
      }
      get PRODUCT_NAME() {
        return this.device.PRODUCT_NAME;
      }
      get HAS_NFC_READER() {
        return this.device.HAS_NFC_READER;
      }
      calculateFillPanelDimensions(...args) {
        return this.device.calculateFillPanelDimensions(...args);
      }
      async close() {
        return this.device.close();
      }
      async getHidDeviceInfo(...args) {
        return this.device.getHidDeviceInfo(...args);
      }
      async sendPreparedBuffer(...args) {
        return this.device.sendPreparedBuffer(...args);
      }
      async fillKeyColor(...args) {
        return this.device.fillKeyColor(...args);
      }
      async fillKeyBuffer(...args) {
        return this.device.fillKeyBuffer(...args);
      }
      async prepareFillKeyBuffer(...args) {
        return this.device.prepareFillKeyBuffer(...args);
      }
      async fillPanelBuffer(...args) {
        return this.device.fillPanelBuffer(...args);
      }
      async prepareFillPanelBuffer(...args) {
        return this.device.prepareFillPanelBuffer(...args);
      }
      async clearKey(...args) {
        return this.device.clearKey(...args);
      }
      async clearPanel(...args) {
        return this.device.clearPanel(...args);
      }
      async setBrightness(...args) {
        return this.device.setBrightness(...args);
      }
      async resetToLogo(...args) {
        return this.device.resetToLogo(...args);
      }
      async getFirmwareVersion() {
        return this.device.getFirmwareVersion();
      }
      async getAllFirmwareVersions() {
        return this.device.getAllFirmwareVersions();
      }
      async getSerialNumber() {
        return this.device.getSerialNumber();
      }
      async fillLcd(...args) {
        return this.device.fillLcd(...args);
      }
      async setEncoderColor(...args) {
        return this.device.setEncoderColor(...args);
      }
      async setEncoderRingSingleColor(...args) {
        return this.device.setEncoderRingSingleColor(...args);
      }
      async setEncoderRingColors(...args) {
        return this.device.setEncoderRingColors(...args);
      }
      async fillLcdRegion(...args) {
        return this.device.fillLcdRegion(...args);
      }
      async prepareFillLcdRegion(...args) {
        return this.device.prepareFillLcdRegion(...args);
      }
      async clearLcdSegment(...args) {
        return this.device.clearLcdSegment(...args);
      }
      async getChildDeviceInfo(...args) {
        return this.device.getChildDeviceInfo(...args);
      }
      /**
       * EventEmitter
       */
      eventNames() {
        return this.device.eventNames();
      }
      listeners(event) {
        return this.device.listeners(event);
      }
      listenerCount(event) {
        return this.device.listenerCount(event);
      }
      emit(event, ...args) {
        return this.device.emit(event, ...args);
      }
      /**
       * Add a listener for a given event.
       */
      on(event, fn, context) {
        this.device.on(event, fn, context);
        return this;
      }
      addListener(event, fn, context) {
        this.device.addListener(event, fn, context);
        return this;
      }
      /**
       * Add a one-time listener for a given event.
       */
      once(event, fn, context) {
        this.device.once(event, fn, context);
        return this;
      }
      /**
       * Remove the listeners of a given event.
       */
      removeListener(event, fn, context, once) {
        this.device.removeListener(event, fn, context, once);
        return this;
      }
      off(event, fn, context, once) {
        this.device.off(event, fn, context, once);
        return this;
      }
      removeAllListeners(event) {
        this.device.removeAllListeners(event);
        return this;
      }
    };
    exports.StreamDeckProxy = StreamDeckProxy;
  }
});

// node_modules/@elgato-stream-deck/core/dist/index.js
var require_dist = __commonJS({
  "node_modules/@elgato-stream-deck/core/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DEVICE_MODELS = exports.DEVICE_MODELS2 = exports.DeviceModelType = exports.CORSAIR_VENDOR_ID = exports.VENDOR_ID = exports.parseAllFirmwareVersionsHelper = exports.uint8ArrayToDataView = exports.StreamDeckProxy = void 0;
    exports.getStreamDeckModelName = getStreamDeckModelName;
    var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
    var id_js_1 = require_id();
    var original_js_1 = require_original();
    var _6_key_js_1 = require_key();
    var _32_key_js_1 = require_key2();
    var _15_key_js_1 = require_key3();
    var plus_js_1 = require_plus();
    var pedal_js_1 = require_pedal2();
    var neo_js_1 = require_neo2();
    var studio_js_1 = require_studio3();
    var network_dock_js_1 = require_network_dock2();
    var galleon_k100_js_1 = require_galleon_k100();
    var plus_xl_js_1 = require_plus_xl();
    tslib_1.__exportStar(require_types(), exports);
    tslib_1.__exportStar(require_id(), exports);
    tslib_1.__exportStar(require_controlDefinition(), exports);
    var proxy_js_1 = require_proxy();
    Object.defineProperty(exports, "StreamDeckProxy", { enumerable: true, get: function() {
      return proxy_js_1.StreamDeckProxy;
    } });
    var util_js_1 = require_util();
    Object.defineProperty(exports, "uint8ArrayToDataView", { enumerable: true, get: function() {
      return util_js_1.uint8ArrayToDataView;
    } });
    var all_firmware_js_1 = require_all_firmware();
    Object.defineProperty(exports, "parseAllFirmwareVersionsHelper", { enumerable: true, get: function() {
      return all_firmware_js_1.parseAllFirmwareVersionsHelper;
    } });
    exports.VENDOR_ID = 4057;
    exports.CORSAIR_VENDOR_ID = 6940;
    var DeviceModelType;
    (function(DeviceModelType2) {
      DeviceModelType2["STREAMDECK"] = "streamdeck";
      DeviceModelType2["PEDAL"] = "pedal";
      DeviceModelType2["NETWORK_DOCK"] = "network-dock";
    })(DeviceModelType || (exports.DeviceModelType = DeviceModelType = {}));
    exports.DEVICE_MODELS2 = {
      [id_js_1.DeviceModelId.ORIGINAL]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [96],
        vendorId: exports.VENDOR_ID,
        factory: original_js_1.StreamDeckOriginalFactory,
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.MINI]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [99, 144, 179],
        vendorId: exports.VENDOR_ID,
        factory: (...args) => (0, _6_key_js_1.StreamDeck6KeyFactory)(id_js_1.DeviceModelId.MINI, ...args),
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.XL]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [108, 143],
        vendorId: exports.VENDOR_ID,
        factory: (...args) => (0, _32_key_js_1.StreamDeck32KeyFactory)(id_js_1.DeviceModelId.XL, ...args),
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.ORIGINALV2]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [109],
        vendorId: exports.VENDOR_ID,
        factory: (...args) => (0, _15_key_js_1.StreamDeck15KeyFactory)(id_js_1.DeviceModelId.ORIGINALV2, ...args),
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.ORIGINALMK2]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [128],
        vendorId: exports.VENDOR_ID,
        factory: (...args) => (0, _15_key_js_1.StreamDeck15KeyFactory)(id_js_1.DeviceModelId.ORIGINALMK2, ...args),
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.ORIGINALMK2SCISSOR]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [165],
        vendorId: exports.VENDOR_ID,
        factory: (...args) => (0, _15_key_js_1.StreamDeck15KeyFactory)(id_js_1.DeviceModelId.ORIGINALMK2SCISSOR, ...args),
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.PLUS]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [132],
        vendorId: exports.VENDOR_ID,
        factory: plus_js_1.StreamDeckPlusFactory,
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.PEDAL]: {
        type: DeviceModelType.PEDAL,
        productIds: [134],
        vendorId: exports.VENDOR_ID,
        factory: pedal_js_1.StreamDeckPedalFactory,
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.NEO]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [154],
        vendorId: exports.VENDOR_ID,
        factory: neo_js_1.StreamDeckNeoFactory,
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.STUDIO]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [170],
        vendorId: exports.VENDOR_ID,
        factory: studio_js_1.StreamDeckStudioFactory,
        hasNativeTcp: true
      },
      [id_js_1.DeviceModelId.MODULE6]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [184],
        vendorId: exports.VENDOR_ID,
        factory: (...args) => (0, _6_key_js_1.StreamDeck6KeyFactory)(id_js_1.DeviceModelId.MODULE6, ...args),
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.MODULE15]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [185],
        vendorId: exports.VENDOR_ID,
        factory: (...args) => (0, _15_key_js_1.StreamDeck15KeyFactory)(id_js_1.DeviceModelId.MODULE15, ...args),
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.MODULE32]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [186],
        vendorId: exports.VENDOR_ID,
        factory: (...args) => (0, _32_key_js_1.StreamDeck32KeyFactory)(id_js_1.DeviceModelId.MODULE32, ...args),
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.MODULE15SCISSOR]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [228],
        vendorId: exports.VENDOR_ID,
        factory: (...args) => (0, _15_key_js_1.StreamDeck15KeyFactory)(id_js_1.DeviceModelId.MODULE15SCISSOR, ...args),
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.NETWORK_DOCK]: {
        type: DeviceModelType.NETWORK_DOCK,
        productIds: [65535],
        // Note: This isn't a real product id, but matches what is reported when querying the device
        vendorId: exports.VENDOR_ID,
        factory: network_dock_js_1.NetworkDockFactory,
        hasNativeTcp: true
      },
      [id_js_1.DeviceModelId.GALLEON_K100]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [11032],
        vendorId: exports.CORSAIR_VENDOR_ID,
        factory: galleon_k100_js_1.GalleonK100Factory,
        hidUsage: 1,
        hidInterface: 0,
        hasNativeTcp: false
      },
      [id_js_1.DeviceModelId.PLUS_XL]: {
        type: DeviceModelType.STREAMDECK,
        productIds: [198],
        vendorId: exports.VENDOR_ID,
        factory: plus_xl_js_1.StreamDeckPlusXlFactory,
        hasNativeTcp: false
      }
    };
    exports.DEVICE_MODELS = Object.entries(exports.DEVICE_MODELS2).map(([id, spec]) => {
      const modelId = id;
      return { id: modelId, productName: id_js_1.MODEL_NAMES[modelId], ...spec };
    });
    function getStreamDeckModelName(modelId) {
      return id_js_1.MODEL_NAMES[modelId] || "Unknown Stream Deck";
    }
  }
});

// node_modules/p-queue/node_modules/eventemitter3/index.js
var require_eventemitter32 = __commonJS({
  "node_modules/p-queue/node_modules/eventemitter3/index.js"(exports, module) {
    "use strict";
    var has = Object.prototype.hasOwnProperty;
    var prefix = "~";
    function Events() {
    }
    if (Object.create) {
      Events.prototype = /* @__PURE__ */ Object.create(null);
      if (!new Events().__proto__) prefix = false;
    }
    function EE(fn, context, once) {
      this.fn = fn;
      this.context = context;
      this.once = once || false;
    }
    function addListener(emitter, event, fn, context, once) {
      if (typeof fn !== "function") {
        throw new TypeError("The listener must be a function");
      }
      var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
      if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
      else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
      else emitter._events[evt] = [emitter._events[evt], listener];
      return emitter;
    }
    function clearEvent(emitter, evt) {
      if (--emitter._eventsCount === 0) emitter._events = new Events();
      else delete emitter._events[evt];
    }
    function EventEmitter() {
      this._events = new Events();
      this._eventsCount = 0;
    }
    EventEmitter.prototype.eventNames = function eventNames() {
      var names = [], events, name;
      if (this._eventsCount === 0) return names;
      for (name in events = this._events) {
        if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
      }
      if (Object.getOwnPropertySymbols) {
        return names.concat(Object.getOwnPropertySymbols(events));
      }
      return names;
    };
    EventEmitter.prototype.listeners = function listeners(event) {
      var evt = prefix ? prefix + event : event, handlers = this._events[evt];
      if (!handlers) return [];
      if (handlers.fn) return [handlers.fn];
      for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
        ee[i] = handlers[i].fn;
      }
      return ee;
    };
    EventEmitter.prototype.listenerCount = function listenerCount(event) {
      var evt = prefix ? prefix + event : event, listeners = this._events[evt];
      if (!listeners) return 0;
      if (listeners.fn) return 1;
      return listeners.length;
    };
    EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return false;
      var listeners = this._events[evt], len = arguments.length, args, i;
      if (listeners.fn) {
        if (listeners.once) this.removeListener(event, listeners.fn, void 0, true);
        switch (len) {
          case 1:
            return listeners.fn.call(listeners.context), true;
          case 2:
            return listeners.fn.call(listeners.context, a1), true;
          case 3:
            return listeners.fn.call(listeners.context, a1, a2), true;
          case 4:
            return listeners.fn.call(listeners.context, a1, a2, a3), true;
          case 5:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
          case 6:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
        }
        for (i = 1, args = new Array(len - 1); i < len; i++) {
          args[i - 1] = arguments[i];
        }
        listeners.fn.apply(listeners.context, args);
      } else {
        var length = listeners.length, j;
        for (i = 0; i < length; i++) {
          if (listeners[i].once) this.removeListener(event, listeners[i].fn, void 0, true);
          switch (len) {
            case 1:
              listeners[i].fn.call(listeners[i].context);
              break;
            case 2:
              listeners[i].fn.call(listeners[i].context, a1);
              break;
            case 3:
              listeners[i].fn.call(listeners[i].context, a1, a2);
              break;
            case 4:
              listeners[i].fn.call(listeners[i].context, a1, a2, a3);
              break;
            default:
              if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) {
                args[j - 1] = arguments[j];
              }
              listeners[i].fn.apply(listeners[i].context, args);
          }
        }
      }
      return true;
    };
    EventEmitter.prototype.on = function on(event, fn, context) {
      return addListener(this, event, fn, context, false);
    };
    EventEmitter.prototype.once = function once(event, fn, context) {
      return addListener(this, event, fn, context, true);
    };
    EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return this;
      if (!fn) {
        clearEvent(this, evt);
        return this;
      }
      var listeners = this._events[evt];
      if (listeners.fn) {
        if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
          clearEvent(this, evt);
        }
      } else {
        for (var i = 0, events = [], length = listeners.length; i < length; i++) {
          if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) {
            events.push(listeners[i]);
          }
        }
        if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
        else clearEvent(this, evt);
      }
      return this;
    };
    EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
      var evt;
      if (event) {
        evt = prefix ? prefix + event : event;
        if (this._events[evt]) clearEvent(this, evt);
      } else {
        this._events = new Events();
        this._eventsCount = 0;
      }
      return this;
    };
    EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
    EventEmitter.prototype.addListener = EventEmitter.prototype.on;
    EventEmitter.prefixed = prefix;
    EventEmitter.EventEmitter = EventEmitter;
    if ("undefined" !== typeof module) {
      module.exports = EventEmitter;
    }
  }
});

// node_modules/p-finally/index.js
var require_p_finally = __commonJS({
  "node_modules/p-finally/index.js"(exports, module) {
    "use strict";
    module.exports = (promise, onFinally) => {
      onFinally = onFinally || (() => {
      });
      return promise.then(
        (val) => new Promise((resolve) => {
          resolve(onFinally());
        }).then(() => val),
        (err) => new Promise((resolve) => {
          resolve(onFinally());
        }).then(() => {
          throw err;
        })
      );
    };
  }
});

// node_modules/p-timeout/index.js
var require_p_timeout = __commonJS({
  "node_modules/p-timeout/index.js"(exports, module) {
    "use strict";
    var pFinally = require_p_finally();
    var TimeoutError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "TimeoutError";
      }
    };
    var pTimeout = (promise, milliseconds, fallback) => new Promise((resolve, reject) => {
      if (typeof milliseconds !== "number" || milliseconds < 0) {
        throw new TypeError("Expected `milliseconds` to be a positive number");
      }
      if (milliseconds === Infinity) {
        resolve(promise);
        return;
      }
      const timer = setTimeout(() => {
        if (typeof fallback === "function") {
          try {
            resolve(fallback());
          } catch (error) {
            reject(error);
          }
          return;
        }
        const message = typeof fallback === "string" ? fallback : `Promise timed out after ${milliseconds} milliseconds`;
        const timeoutError = fallback instanceof Error ? fallback : new TimeoutError(message);
        if (typeof promise.cancel === "function") {
          promise.cancel();
        }
        reject(timeoutError);
      }, milliseconds);
      pFinally(
        // eslint-disable-next-line promise/prefer-await-to-then
        promise.then(resolve, reject),
        () => {
          clearTimeout(timer);
        }
      );
    });
    module.exports = pTimeout;
    module.exports.default = pTimeout;
    module.exports.TimeoutError = TimeoutError;
  }
});

// node_modules/p-queue/dist/lower-bound.js
var require_lower_bound = __commonJS({
  "node_modules/p-queue/dist/lower-bound.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function lowerBound(array, value, comparator) {
      let first = 0;
      let count = array.length;
      while (count > 0) {
        const step = count / 2 | 0;
        let it = first + step;
        if (comparator(array[it], value) <= 0) {
          first = ++it;
          count -= step + 1;
        } else {
          count = step;
        }
      }
      return first;
    }
    exports.default = lowerBound;
  }
});

// node_modules/p-queue/dist/priority-queue.js
var require_priority_queue = __commonJS({
  "node_modules/p-queue/dist/priority-queue.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var lower_bound_1 = require_lower_bound();
    var PriorityQueue = class {
      constructor() {
        this._queue = [];
      }
      enqueue(run, options) {
        options = Object.assign({ priority: 0 }, options);
        const element = {
          priority: options.priority,
          run
        };
        if (this.size && this._queue[this.size - 1].priority >= options.priority) {
          this._queue.push(element);
          return;
        }
        const index = lower_bound_1.default(this._queue, element, (a, b) => b.priority - a.priority);
        this._queue.splice(index, 0, element);
      }
      dequeue() {
        const item = this._queue.shift();
        return item === null || item === void 0 ? void 0 : item.run;
      }
      filter(options) {
        return this._queue.filter((element) => element.priority === options.priority).map((element) => element.run);
      }
      get size() {
        return this._queue.length;
      }
    };
    exports.default = PriorityQueue;
  }
});

// node_modules/p-queue/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/p-queue/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var EventEmitter = require_eventemitter32();
    var p_timeout_1 = require_p_timeout();
    var priority_queue_1 = require_priority_queue();
    var empty = () => {
    };
    var timeoutError = new p_timeout_1.TimeoutError();
    var PQueue = class extends EventEmitter {
      constructor(options) {
        var _a, _b, _c, _d;
        super();
        this._intervalCount = 0;
        this._intervalEnd = 0;
        this._pendingCount = 0;
        this._resolveEmpty = empty;
        this._resolveIdle = empty;
        options = Object.assign({ carryoverConcurrencyCount: false, intervalCap: Infinity, interval: 0, concurrency: Infinity, autoStart: true, queueClass: priority_queue_1.default }, options);
        if (!(typeof options.intervalCap === "number" && options.intervalCap >= 1)) {
          throw new TypeError(`Expected \`intervalCap\` to be a number from 1 and up, got \`${(_b = (_a = options.intervalCap) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : ""}\` (${typeof options.intervalCap})`);
        }
        if (options.interval === void 0 || !(Number.isFinite(options.interval) && options.interval >= 0)) {
          throw new TypeError(`Expected \`interval\` to be a finite number >= 0, got \`${(_d = (_c = options.interval) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : ""}\` (${typeof options.interval})`);
        }
        this._carryoverConcurrencyCount = options.carryoverConcurrencyCount;
        this._isIntervalIgnored = options.intervalCap === Infinity || options.interval === 0;
        this._intervalCap = options.intervalCap;
        this._interval = options.interval;
        this._queue = new options.queueClass();
        this._queueClass = options.queueClass;
        this.concurrency = options.concurrency;
        this._timeout = options.timeout;
        this._throwOnTimeout = options.throwOnTimeout === true;
        this._isPaused = options.autoStart === false;
      }
      get _doesIntervalAllowAnother() {
        return this._isIntervalIgnored || this._intervalCount < this._intervalCap;
      }
      get _doesConcurrentAllowAnother() {
        return this._pendingCount < this._concurrency;
      }
      _next() {
        this._pendingCount--;
        this._tryToStartAnother();
        this.emit("next");
      }
      _resolvePromises() {
        this._resolveEmpty();
        this._resolveEmpty = empty;
        if (this._pendingCount === 0) {
          this._resolveIdle();
          this._resolveIdle = empty;
          this.emit("idle");
        }
      }
      _onResumeInterval() {
        this._onInterval();
        this._initializeIntervalIfNeeded();
        this._timeoutId = void 0;
      }
      _isIntervalPaused() {
        const now = Date.now();
        if (this._intervalId === void 0) {
          const delay = this._intervalEnd - now;
          if (delay < 0) {
            this._intervalCount = this._carryoverConcurrencyCount ? this._pendingCount : 0;
          } else {
            if (this._timeoutId === void 0) {
              this._timeoutId = setTimeout(() => {
                this._onResumeInterval();
              }, delay);
            }
            return true;
          }
        }
        return false;
      }
      _tryToStartAnother() {
        if (this._queue.size === 0) {
          if (this._intervalId) {
            clearInterval(this._intervalId);
          }
          this._intervalId = void 0;
          this._resolvePromises();
          return false;
        }
        if (!this._isPaused) {
          const canInitializeInterval = !this._isIntervalPaused();
          if (this._doesIntervalAllowAnother && this._doesConcurrentAllowAnother) {
            const job = this._queue.dequeue();
            if (!job) {
              return false;
            }
            this.emit("active");
            job();
            if (canInitializeInterval) {
              this._initializeIntervalIfNeeded();
            }
            return true;
          }
        }
        return false;
      }
      _initializeIntervalIfNeeded() {
        if (this._isIntervalIgnored || this._intervalId !== void 0) {
          return;
        }
        this._intervalId = setInterval(() => {
          this._onInterval();
        }, this._interval);
        this._intervalEnd = Date.now() + this._interval;
      }
      _onInterval() {
        if (this._intervalCount === 0 && this._pendingCount === 0 && this._intervalId) {
          clearInterval(this._intervalId);
          this._intervalId = void 0;
        }
        this._intervalCount = this._carryoverConcurrencyCount ? this._pendingCount : 0;
        this._processQueue();
      }
      /**
      Executes all queued functions until it reaches the limit.
      */
      _processQueue() {
        while (this._tryToStartAnother()) {
        }
      }
      get concurrency() {
        return this._concurrency;
      }
      set concurrency(newConcurrency) {
        if (!(typeof newConcurrency === "number" && newConcurrency >= 1)) {
          throw new TypeError(`Expected \`concurrency\` to be a number from 1 and up, got \`${newConcurrency}\` (${typeof newConcurrency})`);
        }
        this._concurrency = newConcurrency;
        this._processQueue();
      }
      /**
      Adds a sync or async task to the queue. Always returns a promise.
      */
      async add(fn, options = {}) {
        return new Promise((resolve, reject) => {
          const run = async () => {
            this._pendingCount++;
            this._intervalCount++;
            try {
              const operation = this._timeout === void 0 && options.timeout === void 0 ? fn() : p_timeout_1.default(Promise.resolve(fn()), options.timeout === void 0 ? this._timeout : options.timeout, () => {
                if (options.throwOnTimeout === void 0 ? this._throwOnTimeout : options.throwOnTimeout) {
                  reject(timeoutError);
                }
                return void 0;
              });
              resolve(await operation);
            } catch (error) {
              reject(error);
            }
            this._next();
          };
          this._queue.enqueue(run, options);
          this._tryToStartAnother();
          this.emit("add");
        });
      }
      /**
          Same as `.add()`, but accepts an array of sync or async functions.
      
          @returns A promise that resolves when all functions are resolved.
          */
      async addAll(functions, options) {
        return Promise.all(functions.map(async (function_) => this.add(function_, options)));
      }
      /**
      Start (or resume) executing enqueued tasks within concurrency limit. No need to call this if queue is not paused (via `options.autoStart = false` or by `.pause()` method.)
      */
      start() {
        if (!this._isPaused) {
          return this;
        }
        this._isPaused = false;
        this._processQueue();
        return this;
      }
      /**
      Put queue execution on hold.
      */
      pause() {
        this._isPaused = true;
      }
      /**
      Clear the queue.
      */
      clear() {
        this._queue = new this._queueClass();
      }
      /**
          Can be called multiple times. Useful if you for example add additional items at a later time.
      
          @returns A promise that settles when the queue becomes empty.
          */
      async onEmpty() {
        if (this._queue.size === 0) {
          return;
        }
        return new Promise((resolve) => {
          const existingResolve = this._resolveEmpty;
          this._resolveEmpty = () => {
            existingResolve();
            resolve();
          };
        });
      }
      /**
          The difference with `.onEmpty` is that `.onIdle` guarantees that all work from the queue has finished. `.onEmpty` merely signals that the queue is empty, but it could mean that some promises haven't completed yet.
      
          @returns A promise that settles when the queue becomes empty, and all promises have completed; `queue.size === 0 && queue.pending === 0`.
          */
      async onIdle() {
        if (this._pendingCount === 0 && this._queue.size === 0) {
          return;
        }
        return new Promise((resolve) => {
          const existingResolve = this._resolveIdle;
          this._resolveIdle = () => {
            existingResolve();
            resolve();
          };
        });
      }
      /**
      Size of the queue.
      */
      get size() {
        return this._queue.size;
      }
      /**
          Size of the queue, filtered by the given options.
      
          For example, this can be used to find the number of items remaining in the queue with a specific priority level.
          */
      sizeBy(options) {
        return this._queue.filter(options).length;
      }
      /**
      Number of pending promises.
      */
      get pending() {
        return this._pendingCount;
      }
      /**
      Whether the queue is currently paused.
      */
      get isPaused() {
        return this._isPaused;
      }
      get timeout() {
        return this._timeout;
      }
      /**
      Set the timeout for future operations.
      */
      set timeout(milliseconds) {
        this._timeout = milliseconds;
      }
    };
    exports.default = PQueue;
  }
});

// node_modules/@elgato-stream-deck/webhid/dist/hid-device.js
var require_hid_device = __commonJS({
  "node_modules/@elgato-stream-deck/webhid/dist/hid-device.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.WebHIDDevice = void 0;
    var eventemitter3_1 = require_eventemitter3();
    var p_queue_1 = require_dist2();
    var WebHIDDevice = class extends eventemitter3_1.EventEmitter {
      device;
      reportQueue = new p_queue_1.default({ concurrency: 1 });
      reportByteLengths = /* @__PURE__ */ new Map();
      constructor(device) {
        super();
        this.device = device;
        this.device.addEventListener("inputreport", (event) => {
          if (event.reportId === 1) {
            const data = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
            this.emit("input", data);
          }
        });
        const featureReports = this.device.collections.map((c) => c.featureReports ?? []).flat();
        for (const report of featureReports) {
          if (report.reportId && report.items) {
            const bitsLength = report.items.reduce((sum, item) => sum + (item.reportSize ?? 0) * (item.reportCount ?? 0), 0);
            this.reportByteLengths.set(report.reportId, Math.ceil(bitsLength / 8));
          }
        }
      }
      async close() {
        return this.device.close();
      }
      async forget() {
        return this.device.forget();
      }
      async sendFeatureReport(data) {
        return this.reportQueue.add(async () => {
          const byteLength = this.reportByteLengths.get(data[0]);
          let dataFull = data.subarray(1);
          if (byteLength && dataFull.length != byteLength) {
            dataFull = new Uint8Array(byteLength);
            dataFull.set(data.subarray(1, Math.min(data.length - 1, dataFull.length)));
          }
          await this.device.sendFeatureReport(data[0], dataFull);
          await new Promise((resolve) => setTimeout(resolve, 1));
        });
      }
      async getFeatureReport(reportId, _reportLength) {
        const view = await this.device.receiveFeatureReport(reportId);
        return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
      }
      async sendReports(buffers) {
        return this.reportQueue.add(async () => {
          for (const data of buffers) {
            await this.device.sendReport(data[0], data.subarray(1));
          }
        });
      }
      async getDeviceInfo() {
        return {
          path: void 0,
          productId: this.device.productId,
          vendorId: this.device.vendorId
        };
      }
      async getChildDeviceInfo() {
        return null;
      }
    };
    exports.WebHIDDevice = WebHIDDevice;
  }
});

// node_modules/@elgato-stream-deck/webhid/dist/jpeg.js
var require_jpeg2 = __commonJS({
  "node_modules/@elgato-stream-deck/webhid/dist/jpeg.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.encodeJPEG = encodeJPEG;
    async function encodeJPEG(buffer, width, height) {
      const blob = await new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const imageData = ctx.createImageData(width, height);
          imageData.data.set(buffer);
          ctx.putImageData(imageData, 0, 0);
          canvas.toBlob((b) => {
            if (b) {
              resolve(b);
            } else {
              reject(new Error("No image generated"));
            }
          }, "image/jpeg", 0.9);
        } else {
          reject(new Error("Failed to get canvas context"));
        }
      });
      return new Uint8Array(await blob.arrayBuffer());
    }
  }
});

// node_modules/@elgato-stream-deck/webhid/dist/wrapper.js
var require_wrapper = __commonJS({
  "node_modules/@elgato-stream-deck/webhid/dist/wrapper.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeckWeb = void 0;
    var core_1 = require_dist();
    var StreamDeckWeb = class extends core_1.StreamDeckProxy {
      hid;
      constructor(device, hid) {
        super(device);
        this.hid = hid;
      }
      /**
       * Instruct the browser to close and forget the device. This will revoke the website's permissions to access the device.
       */
      async forget() {
        await this.hid.forget();
      }
      async fillKeyCanvas(keyIndex, canvas) {
        const ctx = canvas.getContext("2d");
        if (!ctx)
          throw new Error("Failed to get canvas context");
        const control = this.CONTROLS.find((control2) => control2.type === "button" && control2.index === keyIndex);
        if (!control || control.feedbackType === "none")
          throw new TypeError(`Expected a valid keyIndex`);
        if (control.feedbackType !== "lcd")
          throw new TypeError(`keyIndex ${control.index} does not support lcd feedback`);
        const data = ctx.getImageData(0, 0, control.pixelSize.width, control.pixelSize.height);
        return this.device.fillKeyBuffer(keyIndex, data.data, { format: "rgba" });
      }
      async fillPanelCanvas(canvas) {
        const ctx = canvas.getContext("2d");
        if (!ctx)
          throw new Error("Failed to get canvas context");
        const dimensions = this.device.calculateFillPanelDimensions();
        if (!dimensions)
          throw new Error("Panel does not support filling");
        const data = ctx.getImageData(0, 0, dimensions.width, dimensions.height);
        return this.device.fillPanelBuffer(data.data, { format: "rgba" });
      }
    };
    exports.StreamDeckWeb = StreamDeckWeb;
  }
});

// node_modules/@elgato-stream-deck/webhid/dist/index.js
var require_index = __commonJS({
  "node_modules/@elgato-stream-deck/webhid/dist/index.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.StreamDeckWeb = exports.getStreamDeckModelName = exports.StreamDeckProxy = exports.DeviceModelId = exports.CORSAIR_VENDOR_ID = exports.VENDOR_ID = void 0;
    exports.requestStreamDecks = requestStreamDecks;
    exports.getStreamDecks = getStreamDecks;
    exports.openDevice = openDevice;
    var core_1 = require_dist();
    var hid_device_js_1 = require_hid_device();
    var jpeg_js_1 = require_jpeg2();
    var wrapper_js_1 = require_wrapper();
    var core_2 = require_dist();
    Object.defineProperty(exports, "VENDOR_ID", { enumerable: true, get: function() {
      return core_2.VENDOR_ID;
    } });
    Object.defineProperty(exports, "CORSAIR_VENDOR_ID", { enumerable: true, get: function() {
      return core_2.CORSAIR_VENDOR_ID;
    } });
    Object.defineProperty(exports, "DeviceModelId", { enumerable: true, get: function() {
      return core_2.DeviceModelId;
    } });
    Object.defineProperty(exports, "StreamDeckProxy", { enumerable: true, get: function() {
      return core_2.StreamDeckProxy;
    } });
    Object.defineProperty(exports, "getStreamDeckModelName", { enumerable: true, get: function() {
      return core_2.getStreamDeckModelName;
    } });
    var wrapper_js_2 = require_wrapper();
    Object.defineProperty(exports, "StreamDeckWeb", { enumerable: true, get: function() {
      return wrapper_js_2.StreamDeckWeb;
    } });
    async function requestStreamDecks(options) {
      const browserDevices = await navigator.hid.requestDevice({
        filters: [
          {
            vendorId: core_1.VENDOR_ID
          }
        ]
      });
      return Promise.all(browserDevices.map(async (dev) => openDevice(dev, options)));
    }
    async function getStreamDecks(options) {
      const browserDevices = await navigator.hid.getDevices();
      const validDevices = browserDevices.filter((d) => d.vendorId === core_1.VENDOR_ID);
      const resultDevices = await Promise.all(validDevices.map(async (dev) => openDevice(dev, options).catch((_) => null)));
      return resultDevices.filter((v) => !!v);
    }
    async function openDevice(browserDevice, userOptions) {
      const model = core_1.DEVICE_MODELS.find((m) => browserDevice.vendorId === m.vendorId && m.productIds.includes(browserDevice.productId));
      if (!model) {
        throw new Error("Stream Deck is of unexpected type.");
      }
      await browserDevice.open();
      try {
        const options = {
          encodeJPEG: jpeg_js_1.encodeJPEG,
          ...userOptions
        };
        const browserHid = new hid_device_js_1.WebHIDDevice(browserDevice);
        const device = await Promise.resolve(model.factory(browserHid, options || {}));
        return new wrapper_js_1.StreamDeckWeb(device, browserHid);
      } catch (e) {
        await browserDevice.close().catch(() => null);
        throw e;
      }
    }
  }
});
export default require_index();
