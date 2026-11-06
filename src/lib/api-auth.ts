import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export type AuthenticatedSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export async function requireOwnerSession(
  request: Request
): Promise<{ session: AuthenticatedSession } | { errorResponse: NextResponse }> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || !session.user) {
      return {
        errorResponse: NextResponse.json(
          { error: "Unauthorized: Owner session required" },
          { status: 401 }
        ),
      };
    }
    return { session };
  } catch (err) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Session verification failed" },
        { status: 401 }
      ),
    };
  }
}

export function withOwnerAuth<T = unknown>(
  handler: (req: Request, session: AuthenticatedSession, context?: T) => Promise<NextResponse>
) {
  return async (req: Request, context?: T): Promise<NextResponse> => {
    const authResult = await requireOwnerSession(req);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }
    return handler(req, authResult.session, context);
  };
}
