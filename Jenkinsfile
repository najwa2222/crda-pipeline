pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'najwa22/crda-app'
        DOCKER_TAG = "${env.BUILD_ID}"
        KUBE_DIR = 'kubernetes'
        KUBECONFIG = credentials('kubeconfig')
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    bat """
                        docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} .
                        docker tag ${DOCKER_IMAGE}:${DOCKER_TAG} ${DOCKER_IMAGE}:latest
                    """
                }
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    bat """
                        docker login -u %DOCKER_USER% -p %DOCKER_PASS%
                        docker push ${DOCKER_IMAGE}:${DOCKER_TAG}
                        docker push ${DOCKER_IMAGE}:latest
                    """
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                bat """
                    kubectl apply -f ${KUBE_DIR}/mysql-secret.yaml
                    kubectl delete pvc mysql-pv-claim --ignore-not-found
                    kubectl delete pv mysql-pv-volume --ignore-not-found
                    kubectl apply -f ${KUBE_DIR}/mysql-pv.yaml
                    kubectl apply -f ${KUBE_DIR}/mysql-configmap.yaml
                    kubectl apply -f ${KUBE_DIR}/mysql-deployment.yaml
                    kubectl apply -f ${KUBE_DIR}/app-deployment.yaml
                """
            }
        }

        stage('Verify Deployment') {
            steps {
                bat """
                    kubectl get pods
                    kubectl get services
                    kubectl rollout status deployment/app-deployment --timeout=120s
                """
            }
        }
    }

    post {
        always {
            bat """
                docker rmi ${DOCKER_IMAGE}:${DOCKER_TAG} || true
                echo "Cleanup completed"
            """
        }
        failure {
            bat "kubectl describe pods"
        }
    }
}