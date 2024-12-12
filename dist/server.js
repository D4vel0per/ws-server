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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const crypto_1 = require("crypto");
const types_1 = require("./types");
const Sender = __importStar(require("./sender"));
const sender_1 = require("./sender");
const utils_1 = require("./utils");
const app = (0, express_1.default)();
const port = 8000;
const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
const WS_server = new ws_1.Server({ server });
WS_server.on("connection", (socket) => {
    console.log("Someone new connected to the server:", socket.url);
    socket.on("message", (msj) => __awaiter(void 0, void 0, void 0, function* () {
        console.log("WebSocket Message received: Adapting...");
        let processed = yield adapt(msj, socket);
        console.log("Sending Response...");
        socket.send(JSON.stringify(processed));
    }));
});
function checkPkg(pkg) {
    if (typeof pkg === "string")
        return types_1.SenderCargo.STATE;
    const keys = Object.keys(pkg);
    const simpleMessage = ["from", "body", "isStatus", "to"];
    const formInfo = ["clientId", "phoneNumber"];
    if (keys.every(key => simpleMessage.includes(key)))
        return types_1.SenderCargo.MESSAGE;
    if (keys.every(key => formInfo.includes(key)))
        return types_1.SenderCargo.FORM;
    return pkg;
}
function proccessForm(pkg, socket) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Package will be used as Form Data:", pkg);
        const checkedId = ((clientId) => {
            let result = clientId || (0, crypto_1.randomUUID)().split("-")[0];
            if (!clientId.endsWith("_client"))
                result = clientId + "_client";
            return result;
        })(pkg.clientId);
        let status = yield Sender.init(socket, checkedId, pkg.phoneNumber);
        return {
            status,
            checkedId
        };
    });
}
function processMessage(pkg) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Package will be used as Message Data:", pkg);
        pkg.from = (0, utils_1.toPhoneNumber)(pkg.from) || pkg.from;
        pkg.to = (0, utils_1.toChatId)(pkg.to) || pkg.to;
        let client = null;
        if (pkg.from)
            client = sender_1.Storage.getClientByPhoneNumber(pkg.from);
        else {
            console.log("Invalid 'from' number: ", pkg.from);
        }
        let status = types_1.BasicStatus.FAILED;
        if (client && pkg.to) {
            try {
                yield client.sendMessage(pkg.to, pkg.body);
                status = types_1.BasicStatus.SUCCESS;
            }
            catch (err) {
                console.log("Error in processMessage(): ", err);
            }
        }
        else {
            console.log("Got a problem in proccessMessage():");
            console.log(client ? `pkg.to is invalid: ${pkg.to}` : "Client is null");
        }
        return {
            status,
            client
        };
    });
}
function adapt(msj, socket) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        console.log("Reading client data");
        let clientData = JSON.parse(msj.toString());
        let pkg = clientData.package;
        let client = null;
        let status = types_1.BasicStatus.FAILED;
        if (clientData.cargo !== checkPkg(pkg)) {
            console.log("Package is not the same as the cargo type.\n", `Type of cargo: ${clientData.cargo}\n`, `Type of package:`, checkPkg(pkg));
            return {
                status,
                user: undefined
            };
        }
        switch (clientData.cargo) {
            case types_1.SenderCargo.FORM:
                {
                    pkg = pkg;
                    let processed = yield proccessForm(pkg, socket);
                    status = processed.status;
                    client = sender_1.Storage.clients[processed.checkedId];
                }
                break;
            case types_1.SenderCargo.MESSAGE: {
                pkg = pkg;
                let processed = yield processMessage(pkg);
                status = processed.status;
                client = processed.client;
            }
        }
        return {
            status,
            user: (_a = client === null || client === void 0 ? void 0 : client.info) === null || _a === void 0 ? void 0 : _a.wid.user
        };
    });
}
let form = {
    cargo: types_1.SenderCargo.FORM,
    package: {
        clientId: "client_1",
        phoneNumber: "584146715394"
    }
};
let message = {
    cargo: types_1.SenderCargo.MESSAGE,
    package: {
        from: "584146715394@c.us",
        to: "584121108553@c.us",
        body: "HIIIII",
        isStatus: false
    }
};
console.log(JSON.stringify(form));
console.log(JSON.stringify(message));
