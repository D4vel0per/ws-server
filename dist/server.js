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
const app = (0, express_1.default)();
const port = 8000;
const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
const WS_server = new ws_1.Server({ server });
WS_server.on("connection", (socket) => {
    console.log("Someone new connected to the server");
    socket.on("message", (msj) => __awaiter(void 0, void 0, void 0, function* () {
        console.log("WebSocket Message received: Adapting...");
        let processed = yield adapt(msj, socket);
        console.log("Sending Response...");
        socket.send(JSON.stringify(processed));
    }));
});
class Sender {
    static init(socket, clientId, phoneNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            Sender.socket = socket;
            let client;
            if (phoneNumber) {
                console.log("Creating client...");
                client = yield (0, wsp_bot_1.createClient)(clientId, phoneNumber, Sender.delivery);
            }
            else {
                client = yield (0, wsp_bot_1.getClient)(clientId);
                if (Sender.client)
                    yield Sender.client.destroy();
            }
            if (client) {
                console.log("Initialazing client...");
                client = yield (0, wsp_bot_1.initClient)(client, Sender.delivery, phoneNumber);
                console.log("Client ", clientId, "initialized");
                Sender.client = client;
            }
            else {
                console.log("Error initialazing ", clientId, " client");
            }
        });
    }
    static deliver(cargo, pkg) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!Sender.client) {
                console.log("Error: Client is null");
                return;
            }
            console.log("DELIVERING ", cargo);
            const { STATE, PAIRING_CODE, MESSAGE } = wsp_bot_1.SenderCargo;
            let response = {
                type: cargo,
                data: "",
                from: (_a = Sender.client.info) === null || _a === void 0 ? void 0 : _a.wid.user,
                status: "SUCCESS"
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
                        yield Sender.client.sendMessage(pkg.from, "Received: " + pkg.body);
                    }
                    catch (err) {
                        console.log("ERROR:", err);
                        response.status = "FAILED";
                    }
                }
            }
            (_b = Sender.socket) === null || _b === void 0 ? void 0 : _b.send(JSON.stringify(response));
        });
    }
}
exports.Sender = Sender;
Sender.socket = null;
Sender.client = null;
Sender.delivery = {
    show(pkg) {
        console.log("Showing", pkg);
        Sender.deliver(wsp_bot_1.SenderCargo.STATE, pkg);
    },
    sendCode(pkg) {
        console.log("Sending code", pkg);
        Sender.deliver(wsp_bot_1.SenderCargo.PAIRING_CODE, pkg);
    },
    onMessage(pkg) {
        console.log("New message");
        Sender.deliver(wsp_bot_1.SenderCargo.MESSAGE, pkg);
    },
    ready() {
        console.log("Everything up and running... Ready to receive messages.");
    }
};
function adapt(msj, socket) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        console.log("Reading client data");
        let clientData = JSON.parse(msj.toString());
        let isForm = clientData.cargo === wsp_bot_1.SenderCargo.FORM;
        let pkg = clientData.package;
        //let client:Client|null = null;
        if (isForm) {
            console.log("Package will be used as Form Data:", pkg);
            //client = await sender.init(socket, pkg.clientId, pkg.phoneNumber);
            yield Sender.init(socket, pkg.clientId, pkg.phoneNumber);
        }
        return {
            status: Sender.client ? "SUCCESS" : "FAILED",
            user: (_b = (_a = Sender.client) === null || _a === void 0 ? void 0 : _a.info) === null || _b === void 0 ? void 0 : _b.wid.user
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
