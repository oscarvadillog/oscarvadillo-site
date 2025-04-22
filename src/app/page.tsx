/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from "react";

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/notion');
        if (response.ok) {
          const data = await response.json();
          setData(data);
        } else {
          throw new Error('Error fetching data');
        }
      } catch (err) {
        setError('There was a problem loading the data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
        <h1 className="text-3xl font-bold">Loading...</h1>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
        <h1 className="text-3xl font-bold text-red-500">Error! {error}</h1>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Profile</h1>
        {data && data.length > 0 ? (
          data.map((item: any) => (
            <div key={item.id} className="max-w-lg mx-auto mt-6 p-6 border rounded-xl shadow-lg bg-white">
              <h2 className="text-2xl font-semibold mb-4">{item.properties.Name.title[0].text.content}</h2>
              <div className="mb-4">
                <strong>Bio:</strong>
                <p>{item.properties.Bio.rich_text[0].text.content}</p>
              </div>
              <div className="mb-4">
                <strong>Email:</strong>
                <p>{item.properties.Email.email}</p>
              </div>
              <div className="mb-4">
                <strong>Role:</strong>
                <p>{item.properties.Role.rich_text[0].text.content}</p>
              </div>
              <div className="mb-4">
                <strong>Location:</strong>
                <p>{item.properties.Location.rich_text[0].text.content}</p>
              </div>
              <div className="mb-4">
                <strong>Created Time:</strong>
                <p>{new Date(item.properties['Created time'].created_time).toLocaleDateString()}</p>
              </div>
              {item.properties['Profile Picture'].files.length > 0 && (
                <div className="mb-4">
                  <strong>Profile Picture:</strong>
                  <img
                    src={item.properties['Profile Picture'].files[0].file.url}
                    alt="Profile"
                    className="w-32 h-32 rounded-full mx-auto mt-2"
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <p>No data found</p>
        )}
      </div>
    </main>
  );
}
