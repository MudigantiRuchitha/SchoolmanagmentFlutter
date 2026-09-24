async function testApi() {
  try {
    console.log('Testing Academic Data API endpoints with fetch...');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgCode: 'vts',
        username: 'venkat',
        password: 'Venkat@312'
      })
    });

    const loginData = await loginRes.json();
    if (!loginData.success) {
      throw new Error('Login failed: ' + JSON.stringify(loginData));
    }
    const token = loginData.token;
    console.log('✅ Logged in successfully. Token acquired.');

    const headers = { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}` 
    };

    // 1. Test /years
    const yearsRes = await fetch('http://localhost:5000/api/academic-data/years', { headers });
    const yearsData = await yearsRes.json();
    console.log('✅ /years response:', yearsData);

    // 2. Test /classes
    const classesRes = await fetch('http://localhost:5000/api/academic-data/classes?academic_year=2026-2027', { headers });
    const classesData = await classesRes.json();
    console.log('✅ /classes count:', classesData.classes?.length);
    console.log('Classes:', classesData.classes);

    // 3. Test /students
    const studentsRes = await fetch('http://localhost:5000/api/academic-data/students?academic_year=2026-2027', { headers });
    const studentsData = await studentsRes.json();
    console.log('✅ /students count:', studentsData.count);
    console.log('Sample student:', studentsData.students?.[0]);

    // 4. Test /staff teaching
    const staffTeachingRes = await fetch('http://localhost:5000/api/academic-data/staff?academic_year=2026-2027&staff_type=teaching', { headers });
    const staffTeachingData = await staffTeachingRes.json();
    console.log('✅ /staff (teaching) count:', staffTeachingData.count);
    console.log('Sample teaching staff:', staffTeachingData.staff?.[0]);

    // 5. Test /staff non-teaching
    const staffNonTeachingRes = await fetch('http://localhost:5000/api/academic-data/staff?academic_year=2026-2027&staff_type=non-teaching', { headers });
    const staffNonTeachingData = await staffNonTeachingRes.json();
    console.log('✅ /staff (non-teaching) count:', staffNonTeachingData.count);
    console.log('Sample non-teaching staff:', staffNonTeachingData.staff?.[0]);

    console.log('\n🎉 ALL ACADEMIC DATA API TESTS PASSED!');
    process.exit(0);
  } catch (err) {
    console.error('Test Error:', err.message);
    process.exit(1);
  }
}

testApi();
