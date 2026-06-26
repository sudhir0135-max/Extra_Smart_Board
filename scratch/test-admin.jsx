global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.window = { confirm: () => true };
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from '../src/App';
import AdminPanel from '../src/components/AdminPanel';

// Mock properties
const books = [
  { id: 1, title: 'Book 1', author: 'Author 1', classId: '1', subjectId: '1', lessons: [{ id: 'l1', title: 'Lesson 1', pages: [] }] },
  { id: 2, title: 'Book 2', author: 'Author 2', classId: '2', subjectId: '2', color: '#ff0000', coverImage: 'http://example.com/img.jpg', lessons: [{ id: 'l2', title: 'Lesson 2' }] }
];
const academicClasses = [{ id: '1', name: 'Class 1' }, { id: '2', name: 'Class 2' }];
const academicSubjects = [{ id: '1', name: 'Subject 1' }, { id: '2', name: 'Subject 2' }];
const editors = [];

try {
  // Use a hack to set the state by mocking useState temporarily if needed, but since we can't easily do that in a renderToString without a wrapper, let's write a wrapper component.
  const TestWrapper = () => {
    const [activeTab, setActiveTab] = React.useState('books');
    const [selectedBookId, setSelectedBookId] = React.useState(1);
    
    // We will render AdminPanel and pass props, but AdminPanel manages its own state for selectedBookId.
    // Wait, AdminPanel state is internal. We need to trigger the click or just render it.
    return React.createElement(AdminPanel, {
      books,
      academicClasses,
      academicSubjects,
      editors,
      saveBookToFirebase: async () => {},
      deleteBookFromFirebase: async () => {},
      bulkUpdateBooksInFirebase: async () => {},
      onClose: () => {},
      setEditors: () => {}
    });
  };

  const html = renderToString(React.createElement(TestWrapper));
    })
  );
  console.log("Rendered successfully");
} catch (e) {
  console.error("Render failed:", e);
}
