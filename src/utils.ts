import { ChatId } from "./types";

const idRegex = /^\d+@c.us$/

const isChatId = (str:string) => str.match(idRegex)

const toChatId = (str:string): ChatId|void => {
    if (isChatId(str)) return str as ChatId
    let phoneNumber = toPhoneNumber(str)
    if (phoneNumber) 
        return `${phoneNumber}@c.us`
    console.log("Invalid phone number at toChatId: ", str)
}

const toPhoneNumber = (str:string) => str.match(/\d+/g)?.join("") as `${number}`;

export {
    toChatId,
    toPhoneNumber
}