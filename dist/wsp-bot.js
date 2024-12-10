"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SenderCargo = void 0;
exports.getClient = getClient;
exports.createClient = createClient;
exports.initClient = initClient;
const whatsapp_web_js_1 = require("whatsapp-web.js");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const afs = fs.promises;
function getClient(clientId) {
    return __awaiter(this, void 0, void 0, function* () {
        let dir = path.join("clients", clientId);
        try {
            yield afs.access(dir, fs.constants.F_OK);
            console.log("Client", clientId, "at", dir);
        }
        catch (_a) {
            console.log("Client", clientId, "was not found.");
            return null;
        }
        return new whatsapp_web_js_1.Client({
            authStrategy: new whatsapp_web_js_1.LocalAuth({
                clientId,
                dataPath: path.join(path.dirname(__dirname), dir)
            })
        });
    });
}
function createClient(clientId, phoneNumber, delivery) {
    return __awaiter(this, void 0, void 0, function* () {
        let dir = path.join("clients", clientId);
        let ifExists = yield getClient(clientId);
        if (ifExists)
            return ifExists;
        try {
            yield afs.mkdir(dir, { recursive: true });
        }
        catch (err) {
            console.log("ERROR CREATING CLIENT: ", err);
        }
        let client = new whatsapp_web_js_1.Client({
            authStrategy: new whatsapp_web_js_1.LocalAuth({
                clientId,
                dataPath: path.join(path.dirname(__dirname), dir)
            })
        });
        return client;
    });
}
var SenderCargo;
(function (SenderCargo) {
    SenderCargo["STATE"] = "State";
    SenderCargo["PAIRING_CODE"] = "PCode";
    SenderCargo["MESSAGE"] = "Message";
    SenderCargo["FORM"] = "Form";
})(SenderCargo || (exports.SenderCargo = SenderCargo = {}));
function initClient(client, delivery, phoneNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        client.addListener("loading_screen", () => {
            delivery.show("Preparing the spaceship...");
            console.log("Loading...");
        });
        client.addListener("authenticated", () => {
            delivery.show("Everyone on board...");
            console.log("Succesfully Authenticated.");
        });
        client.addListener("auth_failure", (err) => {
            delivery.show("Oh no, something wrong happened!");
            console.log("Authentication failure: ", err);
        });
        client.addListener("ready", delivery.ready);
        client.addListener("message", (msj) => delivery.onMessage(msj));
        client.initialize()
            .then(() => __awaiter(this, void 0, void 0, function* () {
            if (phoneNumber) {
                let pairingCode = yield client.requestPairingCode(phoneNumber, true);
                delivery.sendCode(pairingCode);
            }
        })).catch(err => console.log("Error at initClient:", err));
        return client;
    });
}
