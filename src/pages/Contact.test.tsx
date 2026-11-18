import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ApiValidationError, api } from "../api";
import Contact from "./Contact";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    api: {
      contactMessageOptions: vi.fn(),
      submitContactMessage: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(api, true);

interface AuthState {
  user: { id: number; name: string; email_address: string; roles: string[] } | null;
  loading: boolean;
}

let authState: AuthState = { user: null, loading: false };

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => authState,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <Contact />
    </MemoryRouter>,
  );

async function fillValidForm(
  { email = "jordan@example.com" as string | null } = {},
) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Name"), "Jordan Smith");
  // A signed-in visitor has no editable e-mail field to fill in.
  if (email !== null) await user.type(screen.getByLabelText("Email"), email);
  await user.selectOptions(
    screen.getByLabelText("What is your enquiry about?"),
    "coaching",
  );
  await user.type(screen.getByLabelText("Subject"), "Coaching sessions");
  await user.type(
    screen.getByLabelText("Message"),
    "I would like more information about coaching.",
  );
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  authState = { user: null, loading: false };
  mockedApi.contactMessageOptions.mockResolvedValue({
    contact_types: [
      { value: "general", label: "General enquiry" },
      { value: "coaching", label: "Coaching enquiry" },
    ],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Contact page", () => {
  it("renders the form without a session and lists the server categories", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Contact us" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByLabelText("What is your enquiry about?"),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "General enquiry" }),
      ).toBeInTheDocument(),
    );
  });

  it("falls back to the bundled categories when the options request fails", async () => {
    mockedApi.contactMessageOptions.mockRejectedValue(new Error("offline"));

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "Technical support" }),
      ).toBeInTheDocument(),
    );
  });

  it("validates required fields before calling the API", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(screen.getByText("Please tell us your name.")).toBeInTheDocument();
    expect(
      screen.getByText(/Please enter an email address so we can reply/),
    ).toBeInTheDocument();
    expect(screen.getByText("Please write your message.")).toBeInTheDocument();
    expect(mockedApi.submitContactMessage).not.toHaveBeenCalled();
  });

  it("rejects an invalid email address", async () => {
    renderPage();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "Jordan");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.selectOptions(
      screen.getByLabelText("What is your enquiry about?"),
      "general",
    );
    await user.type(screen.getByLabelText("Subject"), "Hi");
    await user.type(screen.getByLabelText("Message"), "Hello");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(
      screen.getByText("Please enter a valid email address."),
    ).toBeInTheDocument();
    expect(mockedApi.submitContactMessage).not.toHaveBeenCalled();
  });

  it("submits a valid enquiry and confirms only after the API succeeds", async () => {
    mockedApi.submitContactMessage.mockResolvedValue({
      message: "Your message has been received.",
    });

    renderPage();
    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(
        screen.getByText(/Thank you — your message has been received/),
      ).toBeInTheDocument(),
    );
    expect(mockedApi.submitContactMessage).toHaveBeenCalledWith({
      name: "Jordan Smith",
      email: "jordan@example.com",
      contact_type: "coaching",
      subject: "Coaching sessions",
      message: "I would like more information about coaching.",
    });
  });

  it("prevents a duplicate submission while the request is in flight", async () => {
    let resolveSubmit: (value: { message: string }) => void = () => {};
    mockedApi.submitContactMessage.mockReturnValue(
      new Promise<{ message: string }>((resolve) => {
        resolveSubmit = resolve;
      }),
    );

    renderPage();
    const user = await fillValidForm();

    const submit = screen.getByRole("button", { name: "Send message" });
    await user.click(submit);
    await user.click(submit);

    expect(mockedApi.submitContactMessage).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Sending/ })).toBeDisabled();

    resolveSubmit({ message: "ok" });
    await waitFor(() => expect(screen.getByText(/Thank you/)).toBeInTheDocument());
  });

  it("maps server validation errors onto the fields", async () => {
    mockedApi.submitContactMessage.mockRejectedValue(
      new ApiValidationError([
        "Email is not a valid email address",
        "Subject can't be blank",
      ]),
    );

    renderPage();
    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(
        screen.getByText("Email is not a valid email address"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Subject can't be blank")).toBeInTheDocument();
    // The form keeps the entered values so the visitor can correct them.
    expect(screen.getByLabelText("Name")).toHaveValue("Jordan Smith");
  });

  it("shows an actionable message for a rate-limited submission", async () => {
    mockedApi.submitContactMessage.mockRejectedValue(
      Object.assign(new Error("Rate limit exceeded."), { status: 429 }),
    );

    renderPage();
    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(
        screen.getByText(/You have sent several messages recently/),
      ).toBeInTheDocument(),
    );
  });

  it("includes a privacy note discouraging sensitive information", () => {
    renderPage();

    expect(
      screen.getByText(/Please do not include passwords, payment details/),
    ).toBeInTheDocument();
  });

  it("keeps the honeypot out of the accessibility tree", () => {
    renderPage();

    const honeypot = document.querySelector(".contact-honeypot");
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("aria-hidden", "true");
  });

  // --- signed-in visitors -----------------------------------------------------

  it("shows the account email instead of an editable field when signed in", () => {
    authState = {
      user: {
        id: 5,
        name: "Jordan Smith",
        email_address: "jordan@example.com",
        roles: ["player"],
      },
      loading: false,
    };

    renderPage();

    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.getByText("jordan@example.com")).toBeInTheDocument();
    expect(
      screen.getByText("We reply to the email address on your account."),
    ).toBeInTheDocument();
  });

  it("submits the account email for a signed-in visitor", async () => {
    authState = {
      user: {
        id: 5,
        name: "Jordan Smith",
        email_address: "jordan@example.com",
        roles: ["player"],
      },
      loading: false,
    };
    mockedApi.submitContactMessage.mockResolvedValue({
      message: "Your message has been received.",
    });

    renderPage();
    const user = await fillValidForm({ email: null });
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(mockedApi.submitContactMessage).toHaveBeenCalledWith(
        expect.objectContaining({ email: "jordan@example.com" }),
      ),
    );
  });

  it("checks the session before deciding how to collect the email", () => {
    authState = { user: null, loading: true };

    renderPage();

    expect(screen.getByText("Checking your account…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });
});
