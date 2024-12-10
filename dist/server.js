"use strict";
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
exports.Sender = void 0;
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const wsp_bot_1 = require("./wsp-bot");
const crypto_1 = require("crypto");
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
var BasicStatus;
(function (BasicStatus) {
    BasicStatus["SUCCESS"] = "SUCCESS";
    BasicStatus["FAILED"] = "FAILED";
})(BasicStatus || (BasicStatus = {}));
class Sender {
    static init(socket, clientId, phoneNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            Sender.sockets[clientId] = socket;
            let client;
            if (Sender.clients[clientId])
                yield Sender.clients[clientId].destroy();
            if (phoneNumber) {
                console.log("Creating client...");
                client = yield (0, wsp_bot_1.createClient)(clientId);
            }
            else {
                client = yield (0, wsp_bot_1.getClient)(clientId);
            }
            if (client) {
                console.log("Initialazing client...");
                client = yield (0, wsp_bot_1.initClient)(client, Sender.createDelivery(clientId), phoneNumber);
                console.log("Client ", clientId, "initialized");
                Sender.clients[clientId] = client;
                return BasicStatus.SUCCESS;
            }
            else {
                console.log("Error initialazing ", clientId, " client");
                return BasicStatus.FAILED;
            }
        });
    }
    static createDelivery(clientId) {
        let delivery = {
            show: Sender.delivery.show.bind(null, clientId),
            sendCode: Sender.delivery.sendCode.bind(null, clientId),
            onMessage: Sender.delivery.onMessage.bind(null, clientId),
            ready: Sender.delivery.ready.bind(null, clientId)
        };
        return delivery;
    }
    static deliver(cargo, pkg, clientId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!Sender.clients[clientId]) {
                console.log("Error: Client is null");
                return;
            }
            console.log("DELIVERING ", cargo);
            const { STATE, PAIRING_CODE, MESSAGE } = wsp_bot_1.SenderCargo;
            let response = {
                type: cargo,
                data: "",
                from: (_a = Sender.clients[clientId].info) === null || _a === void 0 ? void 0 : _a.wid.user,
                status: BasicStatus.SUCCESS
            };
            switch (cargo) {
                case PAIRING_CODE:
                case STATE:
                    { // Just a state for the client to see...
                        response.data = pkg;
                    }
                    break;
                case MESSAGE: {
                    pkg = pkg;
                    if (pkg.isStatus)
                        return;
                    response.data = JSON.stringify(pkg);
                    try {
                        console.log("Received: " + pkg.body);
                        yield Sender.clients[clientId].sendMessage(pkg.from, "Received: " + pkg.body);
                    }
                    catch (err) {
                        console.log("ERROR:", err);
                        response.status = BasicStatus.FAILED;
                    }
                }
            }
            Sender.sockets[clientId].send(JSON.stringify(response));
        });
    }
}
exports.Sender = Sender;
Sender.sockets = {};
Sender.clients = {};
Sender.delivery = {
    show(clientId, pkg) {
        console.log(`${clientId} -> Showing Status: `, pkg);
        Sender.deliver(wsp_bot_1.SenderCargo.STATE, pkg, clientId);
    },
    sendCode(clientId, pkg) {
        console.log(`${clientId} -> Sending Code: `, pkg);
        Sender.deliver(wsp_bot_1.SenderCargo.PAIRING_CODE, pkg, clientId);
    },
    onMessage(clientId, pkg) {
        console.log(`${clientId} -> Message Received: `, pkg.body);
        Sender.deliver(wsp_bot_1.SenderCargo.MESSAGE, pkg, clientId);
    },
    ready(clientId) {
        console.log(`${clientId} -> Everything up and running... Ready to receive messages.`);
        Sender.deliver(wsp_bot_1.SenderCargo.STATE, "Everything up and running... Ready to receive messages.", clientId);
    }
};
function adapt(msj, socket) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        console.log("Reading client data");
        let clientData = JSON.parse(msj.toString());
        let isForm = clientData.cargo === wsp_bot_1.SenderCargo.FORM;
        let pkg = clientData.package;
        let client = null;
        let status = BasicStatus.FAILED;
        if (isForm) {
            console.log("Package will be used as Form Data:", pkg);
            const checkedId = ((clientId) => {
                let result = clientId || (0, crypto_1.randomUUID)().split("-")[0];
                if (!clientId.endsWith("_client"))
                    result = clientId + "_client";
                return result;
            })(pkg.clientId);
            status = yield Sender.init(socket, checkedId, pkg.phoneNumber);
            client = Sender.clients[checkedId];
        }
        return {
            status,
            user: (_a = client === null || client === void 0 ? void 0 : client.info) === null || _a === void 0 ? void 0 : _a.wid.user
        };
    });
}
let message = {
    cargo: wsp_bot_1.SenderCargo.FORM,
    package: {
        clientId: "client_1",
        phoneNumber: "584146715394"
    }
};
console.log(JSON.stringify(message));
