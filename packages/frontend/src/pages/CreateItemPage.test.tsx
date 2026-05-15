import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { IListing } from "@rento/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateItemPage } from "./CreateItemPage";

const useAuthMock = vi.hoisted(() => vi.fn());
const getCreateMetadataMock = vi.hoisted(() => vi.fn());
const createListingMock = vi.hoisted(() => vi.fn());
const uploadListingPhotoMock = vi.hoisted(() => vi.fn());
const deleteListingPhotoMock = vi.hoisted(() => vi.fn());
const publishListingMock = vi.hoisted(() => vi.fn());
const getOwnedListingForEditMock = vi.hoisted(() => vi.fn());
const updateListingMock = vi.hoisted(() => vi.fn());

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../catalog/catalogApi", () => ({
  getCreateMetadata: (...args: unknown[]) => getCreateMetadataMock(...args),
  createListing: (...args: unknown[]) => createListingMock(...args),
  uploadListingPhoto: (...args: unknown[]) => uploadListingPhotoMock(...args),
  deleteListingPhoto: (...args: unknown[]) => deleteListingPhotoMock(...args),
  publishListing: (...args: unknown[]) => publishListingMock(...args),
  getOwnedListingForEdit: (...args: unknown[]) =>
    getOwnedListingForEditMock(...args),
  updateListing: (...args: unknown[]) => updateListingMock(...args),
}));

function ListingDetailsStub() {
  return <div data-testid="listing-details-route">listing</div>;
}

function renderCreateWizard(initialPath = "/create-item") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/create-item" element={<CreateItemPage />} />
        <Route path="/listings/:id" element={<ListingDetailsStub />} />
        <Route path="/listings/:id/edit" element={<CreateItemPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const mockCategory = {
  id: "cat-1",
  name: "Спорт",
  slug: "sport",
  icon: null,
  order: 1,
  isActive: true,
};

function mockDraftListingWithPhoto(): IListing {
  const now = new Date().toISOString();
  return {
    id: "listing-1",
    ownerId: "u1",
    categoryId: "cat-1",
    category: mockCategory,
    title: "Палатка",
    description: "Состояние: good. Отличная палатка",
    rentalPrice: 500,
    rentalPeriod: "DAY",
    depositAmount: 1000,
    status: "DRAFT",
    addressText: null,
    latitude: null,
    longitude: null,
    photos: [
      {
        id: "p1",
        url: "https://example.com/photo.jpg",
        thumbnailUrl: null,
        order: 0,
        isPrimary: true,
        uploadedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

describe("CreateItemPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      user: { id: "u1", email: "test@example.com" },
      accessToken: "token-123",
    });
    getCreateMetadataMock.mockResolvedValue({
      categories: [{ id: "cat-1", name: "Спорт" }],
    });
    createListingMock.mockResolvedValue({
      id: "listing-1",
      status: "DRAFT",
      message: "Draft created",
      nextStep: "upload_photos",
    });
    uploadListingPhotoMock.mockResolvedValue({
      photo: { id: "p1", url: "https://example.com/photo.jpg" },
      totalPhotos: 1,
      message: "Photo uploaded",
      nextStep: "publish_listing",
    });
    deleteListingPhotoMock.mockResolvedValue({
      success: true,
      totalPhotos: 0,
      message: "Photo removed",
    });
    publishListingMock.mockResolvedValue({
      id: "listing-1",
      status: "ACTIVE",
      message: "Listing published successfully",
      nextStep: null,
    });
  });

  it("renders create form fields", async () => {
    renderCreateWizard();

    expect(
      screen.getByRole("heading", { name: /новое объявление/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^название$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/категория товара/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/размер залога/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(getCreateMetadataMock).toHaveBeenCalledWith("token-123");
    });
  });

  it("navigates to listing details after draft creation", async () => {
    const user = userEvent.setup();
    renderCreateWizard();

    await waitFor(() => expect(getCreateMetadataMock).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/^название$/i), "Палатка");
    await user.selectOptions(
      screen.getByLabelText(/категория товара/i),
      "cat-1",
    );
    await user.type(screen.getByLabelText(/цена за период/i), "500");
    await user.type(
      screen.getByLabelText(/расскажите о нём/i),
      "Отличная палатка",
    );
    await user.type(screen.getByLabelText(/размер залога/i), "1000");
    await user.selectOptions(
      screen.getByLabelText(/состояние товара/i),
      "good",
    );

    await user.click(screen.getByRole("button", { name: /создать черновик/i }));

    await waitFor(() => expect(createListingMock).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByTestId("listing-details-route"),
    ).toBeInTheDocument();
  });

  it("queues photo before draft creation and uploads it after save", async () => {
    const user = userEvent.setup();
    renderCreateWizard();

    await waitFor(() => expect(getCreateMetadataMock).toHaveBeenCalled());

    const fileInput = screen.getByLabelText(
      /добавить фото/i,
    ) as HTMLInputElement;
    const file = new File(["image-bytes"], "before-create.jpg", {
      type: "image/jpeg",
    });
    await user.upload(fileInput, file);

    await user.type(screen.getByLabelText(/^название$/i), "Палатка");
    await user.selectOptions(
      screen.getByLabelText(/категория товара/i),
      "cat-1",
    );
    await user.type(screen.getByLabelText(/цена за период/i), "500");
    await user.type(
      screen.getByLabelText(/расскажите о нём/i),
      "Отличная палатка",
    );
    await user.type(screen.getByLabelText(/размер залога/i), "1000");
    await user.selectOptions(
      screen.getByLabelText(/состояние товара/i),
      "good",
    );
    await user.click(screen.getByRole("button", { name: /создать черновик/i }));

    await waitFor(() => expect(createListingMock).toHaveBeenCalled());
    await waitFor(() => {
      expect(uploadListingPhotoMock).toHaveBeenCalledWith(
        "listing-1",
        expect.any(File),
        "token-123",
      );
    });
    expect(
      await screen.findByTestId("listing-details-route"),
    ).toBeInTheDocument();
  });

  it("allows creating draft without filling description body", async () => {
    const user = userEvent.setup();
    renderCreateWizard();

    await waitFor(() => expect(getCreateMetadataMock).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/^название$/i), "Палатка");
    await user.selectOptions(
      screen.getByLabelText(/категория товара/i),
      "cat-1",
    );
    await user.type(screen.getByLabelText(/цена за период/i), "500");
    await user.type(screen.getByLabelText(/размер залога/i), "1000");
    await user.selectOptions(
      screen.getByLabelText(/состояние товара/i),
      "good",
    );
    expect(screen.getByLabelText(/расскажите о нём/i)).not.toHaveAttribute(
      "required",
    );
    await user.click(screen.getByRole("button", { name: /создать черновик/i }));

    await waitFor(() => expect(createListingMock).toHaveBeenCalledTimes(1));
  });

  it("publishes draft from edit route and opens listing details", async () => {
    const user = userEvent.setup();
    getOwnedListingForEditMock.mockResolvedValue(mockDraftListingWithPhoto());
    renderCreateWizard("/listings/listing-1/edit");

    await waitFor(() =>
      expect(getOwnedListingForEditMock).toHaveBeenCalledWith(
        "listing-1",
        "token-123",
      ),
    );
    expect(
      await screen.findByRole("heading", {
        name: /редактирование объявления/i,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^опубликовать$/i }));

    await waitFor(() => {
      expect(publishListingMock).toHaveBeenCalledWith("listing-1", "token-123");
    });
    expect(
      await screen.findByTestId("listing-details-route"),
    ).toBeInTheDocument();
  });
});
