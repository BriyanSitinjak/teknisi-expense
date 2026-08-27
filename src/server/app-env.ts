import type { IronSession } from "iron-session";
import type { SessionData, SessionUser } from "@/server/auth/session";

export type AppEnv = {
  Variables: {
    session: IronSession<SessionData>;
    user: SessionUser;
  };
};
