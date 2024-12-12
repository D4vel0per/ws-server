enum SenderCargo {
    STATE = "State",
    PAIRING_CODE = "PCode",
    MESSAGE = "Message",
    FORM = "Form"
}

type simpleMessage = {
    to: ChatId,
    from: string,
    body: string,
    isStatus: boolean
}

type formInfo = {
    clientId: string,
    phoneNumber?: string
}

type ChatId = `${number}@c.us`

type SenderPkg = string|simpleMessage|formInfo

interface SenderInfo {
    cargo: SenderCargo,
    package: SenderPkg
  }
  
interface SenderResponse {
    type: SenderCargo,
    data: string,
    from: string,
    status: BasicStatus
}
  
interface Delivery {
    show: (clientId: ClientId, pkg: string) => void,
    sendCode: (clientId: ClientId, pkg: string) => void,
    onMessage: (clientId: ClientId, pkg: simpleMessage) => void,
    ready: (clientId: ClientId) => void
}
  
interface BindedDelivery {
    show: (pkg: string) => void,
    sendCode: (pkg: string) => void,
    onMessage: (pkg: simpleMessage) => void,
    ready: () => void
}
  
enum BasicStatus {
    SUCCESS = "SUCCESS",
    FAILED = "FAILED"
}
  
type ClientId = `${string}_client`

interface AdapterResponse {
    status: BasicStatus
    user: string | undefined
}

export {
    SenderCargo,
    simpleMessage,
    formInfo,
    SenderPkg,
    SenderInfo,
    SenderResponse,
    Delivery,
    BindedDelivery,
    BasicStatus,
    ClientId,
    AdapterResponse,
    ChatId
}