import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { Route, Router, Switch } from "wouter";
import AdminNav, { adminNavItems } from "@/components/admin/AdminNav";
import { adminRoutes } from "./routes";

// The admin shell lives under `<Route path="/admin" nest>`, so wouter resolves
// its links and matches its routes relative to /admin. These checks render the
// real nav and the real route table at real browser URLs (wouter's ssrPath), so
// a link that would land on the 404 page — as every menu item once did, when
// "/admin/funnels" resolved to /admin/admin/funnels — fails here, not in production.
//
// Run with `pnpm --filter @workspace/phoenix-operations run test`. No browser,
// no network, no database.

const NONE = "matched:none";

/** The admin route pattern the nested router picks for a browser URL, or NONE. */
const matchedRoute = (url: string) =>
  renderToString(
    <Router ssrPath={url}>
      <Route path="/admin" nest>
        <Switch>
          {adminRoutes.map((route) => (
            <Route key={route.path} path={route.path}>{`matched:${route.path}`}</Route>
          ))}
          <Route>{NONE}</Route>
        </Switch>
      </Route>
    </Router>,
  );

/** The nav as a browser renders it at `url`: each link's href and whether it is highlighted. */
const renderedNav = (url: string, role = "super_admin") => {
  const html = renderToString(
    <Router ssrPath={url}>
      <Route path="/admin" nest>
        <AdminNav role={role} />
      </Route>
    </Router>,
  );
  return [...html.matchAll(/<a href="([^"]*)"(?: class="([^"]*)")?>([^<]*)<\/a>/g)].map((match) => ({
    href: match[1],
    active: match[2] === "active",
    label: match[3].replace(/&amp;/g, "&"),
  }));
};

const activeLabels = (url: string) => renderedNav(url).filter((link) => link.active).map((link) => link.label);

test("every menu item links to its own admin screen, not the 404 page", () => {
  const links = renderedNav("/admin");
  assert.equal(links.length, adminNavItems.length, "the super admin sees every item");
  for (const [index, item] of adminNavItems.entries()) {
    const link = links[index];
    assert.equal(link.label, item.label);
    assert.equal(link.href, `/admin${item.href}`, `${item.label} must link under /admin exactly once`);
    assert.equal(matchedRoute(link.href), `matched:${item.href}`, `${item.label} (${link.href}) must reach its own route`);
  }
});

test("the highlighted menu item follows the nested location", () => {
  for (const item of adminNavItems) {
    assert.deepEqual(activeLabels(`/admin${item.href}`), [item.label]);
  }
  assert.deepEqual(activeLabels("/admin/contacts/ld_101"), ["Contacts"], "a contact's detail page keeps Contacts lit");
  assert.deepEqual(activeLabels("/admin/funnels/new"), ["Funnels"], "the funnel builder keeps Funnels lit");
});

test("detail screens resolve under the same base", () => {
  assert.equal(matchedRoute("/admin/contacts/ld_101"), "matched:/contacts/:id");
  assert.equal(matchedRoute("/admin/funnels/new"), "matched:/funnels/:id");
  assert.equal(matchedRoute("/admin/funnels/fn_7"), "matched:/funnels/:id");
});

test("a doubled /admin prefix is the 404 page (the regression this guards against)", () => {
  assert.equal(matchedRoute("/admin/admin/funnels"), NONE);
  assert.equal(matchedRoute("/admin/admin"), NONE);
  assert.equal(matchedRoute("/admin/no-such-screen"), NONE);
});

test("the menu follows the permissions table", () => {
  const everyone = ["Dashboard", "Contacts", "Sequences"];
  assert.deepEqual(renderedNav("/admin", "staff").map((link) => link.label), everyone);
  assert.deepEqual(renderedNav("/admin", "partner").map((link) => link.label), everyone);
  assert.deepEqual(renderedNav("/admin", "owner").map((link) => link.label), adminNavItems.map((item) => item.label));
  assert.deepEqual(renderedNav("/admin", "not-a-role").map((link) => link.label), everyone);
});
