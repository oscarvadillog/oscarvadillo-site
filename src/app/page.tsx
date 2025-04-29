'use client';

import { useEffect, useState } from "react";
import Image from "next/image";

interface NotionUser {
  id: string;
  properties: {
    Name: {
      title: {
        text: {
          content: string;
        };
      }[];
    };
    Role: {
      rich_text: {
        text: {
          content: string;
        };
      }[];
    };
    Bio: {
      rich_text: {
        text: {
          content: string;
        };
      }[];
    };
    Email: {
      email: string;
    };
    Location: {
      rich_text: {
        text: {
          content: string;
        };
      }[];
    };
    'Created time': {
      created_time: string;
    };
    'Profile Picture': {
      files: {
        file: {
          url: string;
        };
      }[];
    };
  };
}

export default function Home() {
  const [data, setData] = useState<NotionUser[] | null>(null);
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
      <main className="min-h-screen flex items-center justify-center font-sans bg-gray-50">
        <h1 className="text-3xl font-bold animate-pulse text-gray-700">Loading...</h1>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center font-sans bg-gray-50">
        <h1 className="text-3xl font-bold text-red-600">{error}</h1>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 font-sans px-4 py-12">
      <div className="w-full max-w-3xl">
        {data && data.length > 0 ? (
          data!.map((item: NotionUser) => (
            <div
              key={item.id}
              className="p-6 bg-white rounded-2xl shadow-lg border border-gray-200 mb-8 transition-transform hover:scale-[1.02]"
            >
              <div className="flex flex-col items-center text-center">
                {item.properties['Profile Picture'].files.length > 0 && (
                  <Image
                    src={item.properties['Profile Picture'].files[0].file.url}
                    width={112}
                    height={112}
                    alt="Profile"
                    className="w-28 h-28 rounded-full object-cover mb-4 border-2 border-gray-300"
                  />
                )}
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  {item.properties.Name.title[0].text.content}
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  {item.properties.Role.rich_text[0].text.content}
                </p>
              </div>
              <div className="text-left text-gray-700 space-y-2">
                <p><span className="font-semibold">Bio:</span> {item.properties.Bio.rich_text[0].text.content}</p>
                <p><span className="font-semibold">Email:</span> {item.properties.Email.email}</p>
                <p><span className="font-semibold">Location:</span> {item.properties.Location.rich_text[0].text.content}</p>
                <p><span className="font-semibold">Joined:</span> {new Date(item.properties['Created time'].created_time).toLocaleDateString()}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-600">No data found.</p>
        )}
      </div>
    </main>
  );
}
