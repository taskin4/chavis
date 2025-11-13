document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.main-container');

    if (!container) {
        console.error("No element found with class 'main-container'");
        return;
    }

    let lastX = 0;
    let lastY = 0;

    const smoothFactor = 0.15;

    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const targetRotateX = ((y - centerY) / centerY) * -15;
        const targetRotateY = ((x - centerX) / centerX) * 15;

        lastX = lastX + (targetRotateX - lastX) * smoothFactor;
        lastY = lastY + (targetRotateY - lastY) * smoothFactor;

        container.style.transform = `perspective(1000px) rotateX(${lastX}deg) rotateY(${lastY}deg)`;
    });

    container.addEventListener('mouseleave', () => {
        lastX = 0;
        lastY = 0;
        container.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
        container.style.transition = "transform 0.55s ease-out";
    });
});
