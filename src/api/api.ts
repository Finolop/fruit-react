const API_URL = process.env.REACT_APP_API_URL!;


export const uploadImage = async (file: File) => {
    const formData = new FormData();

    formData.append('image', file);

    const response = await fetch(`${API_URL}/TODO_IMAGES`, {
        method: 'POST',
        body: formData,
    });

    return response.json();
};

export const getAnalysis = async () => {
    const response = await fetch(`${API_URL}/TODO_ANALYSIS`);

    return response.json();
};