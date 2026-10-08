export const uploadValidIDAsync = async (
  uri: string
) => {
  try {
    const data = new FormData();

    data.append("file", {
      uri,
      type: "image/jpeg",
      name: "upload.jpg",
    } as any);

    data.append(
      "upload_preset",
      "farmgate_validids"
    );

    const response = await fetch(
      "https://api.cloudinary.com/v1_1/dc9jkdgaf/image/upload",
      {
        method: "POST",
        body: data,
      }
    );

    const file = await response.json();

    return file.secure_url;

  } catch (error) {
    console.log(error);
    throw error;
  }
};