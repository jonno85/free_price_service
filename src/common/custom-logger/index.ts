import log4js from "log4js";

const CustomLogger = log4js.getLogger("emma");
CustomLogger.level = "info";

export default CustomLogger;
