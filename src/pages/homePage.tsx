import React, { useEffect, useState } from "react";

import "../styles/App.css";

import { FruitAnalysis } from "../types/analysis";
import { getAnalysis, uploadImage } from "../api/api";

const HomePage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<FruitAnalysis[]>([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const result = await getAnalysis();
      setData(result);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      return;
    }

    await uploadImage(file);
  };

  return (
    <div className="App">
      <div className="container">
        <h1>Анализ фруктов</h1>

        <article className="upload-card">
          <h2>Загрузить фрукт</h2>

          <input type="file" accept="image/*" onChange={handleFileChange} />

          {file && (
            <div className="preview">
              <img src={URL.createObjectURL(file)} alt="Выбранный фрукт" />

              <p>{file.name}</p>
            </div>
          )}

          <button onClick={handleUpload} disabled={!file}>
            Отправить
          </button>
        </article>

        <article className="data-card">
          <h2 className="data-card__title">Данные о фрукте</h2>

          <pre>{JSON.stringify(data, null, 2)}</pre>
        </article>
      </div>
    </div>
  );
};

export default HomePage;
