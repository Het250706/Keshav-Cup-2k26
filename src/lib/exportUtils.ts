import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToPDF = (teams: any[], players: any[]) => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('KESHAV CUP 2026 - FINAL SQUAD ROSTERS', 14, 22);

    let currentY = 30;

    teams.forEach((team) => {
        const teamPlayers = players.filter(p => p.team_id === team.id);

        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text(`${team.name.toUpperCase()} (Balance: ₹ ${(team.remaining_budget / 10000000).toFixed(2)} Cr)`, 14, currentY + 10);

        const tableData = teamPlayers.map((p, i) => [
            i + 1,
            `${p.first_name} ${p.last_name}`,
            p.role,
            p.category,
            `₹ ${(p.sold_price / 10000000).toFixed(2)} Cr`
        ]);

        autoTable(doc, {
            startY: currentY + 15,
            head: [['#', 'PLAYER NAME', 'ROLE', 'CAT', 'PRICE']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [255, 215, 0], textColor: [0, 0, 0] },
            margin: { left: 14, right: 14 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.save('Keshav_Cup_Rosters.pdf');
};

export const exportToCSV = (players: any[]) => {
    const headers = ['First Name', 'Last Name', 'Role', 'Category', 'Base Price', 'Status', 'Team', 'Sold Price'];
    const rows = players.map(p => [
        p.first_name,
        p.last_name,
        p.role,
        p.category,
        p.base_price,
        p.auction_status,
        p.team_name || 'N/A',
        p.sold_price || 0
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'Keshav_Cup_Players.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
