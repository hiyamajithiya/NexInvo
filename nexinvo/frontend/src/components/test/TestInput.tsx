import React, { useState } from 'react';

const TestInput: React.FC = () => {
  const [value, setValue] = useState('');

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Test Input Component</h1>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
        placeholder="Type here to test focus"
      />
      <p className="mt-2">Current value: {value}</p>
    </div>
  );
};

export default TestInput;