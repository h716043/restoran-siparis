import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, hostname } = req.nextUrl;

  // Netlify veya Müşteri-Özel (Customer-Only) bulut yayınında Admin ve Mutfak panellerini dış dünyaya tamamen kapat
  const isCloudCustomerOnly =
    process.env.NETLIFY === "true" ||
    process.env.NEXT_PUBLIC_CUSTOMER_ONLY === "true" ||
    hostname.endsWith(".netlify.app");

  if (
    isCloudCustomerOnly &&
    (pathname.startsWith("/admin") ||
      pathname.startsWith("/kitchen") ||
      pathname.startsWith("/staff-login"))
  ) {
    const homeUrl = new URL("/", req.url);
    return NextResponse.redirect(homeUrl);
  }

  const role = req.cookies.get("restoran_staff_role")?.value;

  // /admin rotası sadece "admin" rolüne açıktır (Yerelde)
  if (pathname.startsWith("/admin")) {
    if (role !== "admin") {
      const loginUrl = new URL("/staff-login", req.url);
      loginUrl.searchParams.set("target", "admin");
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // /kitchen rotası "admin" veya "kitchen" rolüne açıktır (Yerelde)
  if (pathname.startsWith("/kitchen")) {
    if (role !== "admin" && role !== "kitchen") {
      const loginUrl = new URL("/staff-login", req.url);
      loginUrl.searchParams.set("target", "kitchen");
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/kitchen/:path*", "/staff-login/:path*"],
};

