export const deleteCloudinaryImage =
  async (publicId: string) => {

    try {

      const response =
        await fetch(
          "https://farmgate-backend-mrx6.onrender.com/delete-image",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              public_id: publicId,
            }),
          }
        );

      const data =
        await response.json();

      console.log(
        "DELETE IMAGE RESPONSE:",
        data
      );

    } catch (error) {

      console.log(
        "DELETE IMAGE ERROR:",
        error
      );

    }

};